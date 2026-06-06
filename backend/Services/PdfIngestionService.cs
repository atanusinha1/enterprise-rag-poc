using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.SemanticKernel.Embeddings;
using Npgsql;
using UglyToad.PdfPig;

namespace EnterpriseRagPoc.Services
{
    public class PdfIngestionService
    {
        private readonly ITextEmbeddingGenerationService _embeddingService;
        private readonly NpgsqlDataSource _dataSource;
        private readonly int _chunkSize;
        private readonly int _chunkOverlap;

        public PdfIngestionService(
            ITextEmbeddingGenerationService embeddingService,
            NpgsqlDataSource dataSource,
            IConfiguration configuration)
        {
            _embeddingService = embeddingService;
            _dataSource = dataSource;
            
            _chunkSize = configuration.GetValue<int>("RAGSettings:ChunkSize", 800);
            _chunkOverlap = configuration.GetValue<int>("RAGSettings:ChunkOverlap", 150);
        }

        public async Task IngestPdfAsync(Stream pdfStream, string fileName)
        {
            // 1. Extract text page-by-page
            var pagesText = ExtractTextFromPdf(pdfStream);

            // 2. Chunk text page-by-page
            var chunks = CreateChunks(pagesText, fileName);

            // 3. Generate embeddings and save to pgvector in batches
            await SaveChunksToDatabaseAsync(chunks);
        }

        private List<PdfPageContent> ExtractTextFromPdf(Stream pdfStream)
        {
            var result = new List<PdfPageContent>();
            
            using (var pdfDocument = PdfDocument.Open(pdfStream))
            {
                foreach (var page in pdfDocument.GetPages())
                {
                    string text = page.Text;
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        result.Add(new PdfPageContent
                        {
                            PageNumber = page.Number,
                            Content = text
                        });
                    }
                }
            }

            return result;
        }

        private List<DocumentChunk> CreateChunks(List<PdfPageContent> pages, string fileName)
        {
            var chunks = new List<DocumentChunk>();
            int globalChunkIndex = 0;

            foreach (var page in pages)
            {
                string text = page.Content;
                int pageNum = page.PageNumber;

                // Simple character-based sliding window chunking that respects word boundaries
                int currentIndex = 0;

                while (currentIndex < text.Length)
                {
                    int length = Math.Min(_chunkSize, text.Length - currentIndex);
                    string rawChunk = text.Substring(currentIndex, length);

                    // Try to adjust chunk boundary to end of the word to avoid mid-word cuts
                    if (currentIndex + length < text.Length)
                    {
                        int lastSpace = rawChunk.LastIndexOf(' ');
                        if (lastSpace > _chunkSize / 2) // only cut if space is in reasonable range
                        {
                            length = lastSpace;
                            rawChunk = text.Substring(currentIndex, length);
                        }
                    }

                    chunks.Add(new DocumentChunk
                    {
                        FileName = fileName,
                        Content = rawChunk.Trim(),
                        PageNumber = pageNum,
                        ChunkIndex = globalChunkIndex++
                    });

                    currentIndex += (length - _chunkOverlap);
                    if (currentIndex >= text.Length || length <= _chunkOverlap)
                    {
                        break;
                    }
                }
            }

            return chunks;
        }

        private async Task SaveChunksToDatabaseAsync(List<DocumentChunk> chunks)
        {
            using var conn = _dataSource.CreateConnection();
            await conn.OpenAsync();

            foreach (var chunk in chunks)
            {
                // Generate embeddings via Azure OpenAI through Semantic Kernel
                var embedding = await _embeddingService.GenerateEmbeddingAsync(chunk.Content);
                var vector = embedding.ToArray();

                // Insert chunk text, metadata, and embedding into PostgreSQL pgvector
                using var cmd = new NpgsqlCommand(
                    @"INSERT INTO rag_documents (file_name, content, page_number, chunk_index, embedding) 
                      VALUES (@file_name, @content, @page_number, @chunk_index, @embedding);", conn);

                cmd.Parameters.AddWithValue("file_name", chunk.FileName);
                cmd.Parameters.AddWithValue("content", chunk.Content);
                cmd.Parameters.AddWithValue("page_number", chunk.PageNumber);
                cmd.Parameters.AddWithValue("chunk_index", chunk.ChunkIndex);
                
                var embeddingParam = cmd.Parameters.AddWithValue("embedding", new Pgvector.Vector(vector));
                embeddingParam.DataTypeName = "vector";

                await cmd.ExecuteNonQueryAsync();
            }
        }
    }

    public class PdfPageContent
    {
        public int PageNumber { get; set; }
        public string Content { get; set; } = string.Empty;
    }

    public class DocumentChunk
    {
        public string FileName { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public int PageNumber { get; set; }
        public int ChunkIndex { get; set; }
    }
}
