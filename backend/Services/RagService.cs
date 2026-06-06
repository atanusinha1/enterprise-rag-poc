using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Embeddings;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using Npgsql;

namespace EnterpriseRagPoc.Services
{
    public class RagService
    {
        private readonly ITextEmbeddingGenerationService _embeddingService;
        private readonly IChatCompletionService _chatService;
        private readonly NpgsqlDataSource _dataSource;
        private readonly int _searchLimit;
        private readonly double _minimumSimilarity;

        public RagService(
            ITextEmbeddingGenerationService embeddingService,
            IChatCompletionService chatService,
            NpgsqlDataSource dataSource,
            IConfiguration configuration)
        {
            _embeddingService = embeddingService;
            _chatService = chatService;
            _dataSource = dataSource;

            _searchLimit = configuration.GetValue<int>("RAGSettings:SearchLimit", 5);
            _minimumSimilarity = configuration.GetValue<double>("RAGSettings:MinimumSimilarity", 0.3);
        }

        public async Task<List<SearchResultItem>> SearchSimilarChunksAsync(string query, int? limit = null)
        {
            int maxLimit = limit ?? _searchLimit;

            // 1. Generate embedding for user query
            var queryEmbedding = await _embeddingService.GenerateEmbeddingAsync(query);
            var queryVector = queryEmbedding.ToArray();

            var results = new List<SearchResultItem>();

            // 2. Query PostgreSQL pgvector database using cosine distance (<=>)
            using var conn = _dataSource.CreateConnection();
            await conn.OpenAsync();

            string searchSql = @"
                SELECT file_name, content, page_number, chunk_index,
                       1 - (embedding <=> @query_vector) AS similarity
                FROM rag_documents
                WHERE 1 - (embedding <=> @query_vector) >= @min_similarity
                ORDER BY embedding <=> @query_vector
                LIMIT @limit;";

            using var cmd = new NpgsqlCommand(searchSql, conn);
            var queryVectorParam = cmd.Parameters.AddWithValue("query_vector", new Pgvector.Vector(queryVector));
            queryVectorParam.DataTypeName = "vector";
            
            cmd.Parameters.AddWithValue("min_similarity", (float)_minimumSimilarity);
            cmd.Parameters.AddWithValue("limit", maxLimit);

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                results.Add(new SearchResultItem
                {
                    FileName = reader.GetString(0),
                    Content = reader.GetString(1),
                    PageNumber = reader.GetInt32(2),
                    ChunkIndex = reader.GetInt32(3),
                    SimilarityScore = reader.GetDouble(4)
                });
            }

            return results;
        }

        public async Task<RagResponse> AskQuestionAsync(string question)
        {
            // 1. Retrieve the most relevant text chunks (contexts)
            var citations = await SearchSimilarChunksAsync(question);

            if (!citations.Any())
            {
                return new RagResponse
                {
                    Answer = "No relevant context was found in the database. Please make sure documents have been uploaded and indexed.",
                    Citations = new List<SearchResultItem>()
                };
            }

            // 2. Build the system and user prompt with context injection
            var systemPrompt = new StringBuilder();
            systemPrompt.AppendLine("You are an Enterprise RAG Assistant. Answer the user's question based strictly on the provided context passages.");
            systemPrompt.AppendLine("If the context does not contain the answer, say: 'I could not find the answer in the provided documents.'");
            systemPrompt.AppendLine("Do not make up facts or use external knowledge outside the provided context.");
            systemPrompt.AppendLine("Whenever you use information from a context chunk, cite it by placing the document name and page number at the end of the sentence or statement (e.g., [DocumentName.pdf, Page X]).");
            systemPrompt.AppendLine("\nContext passages:");
            
            foreach (var cite in citations)
            {
                systemPrompt.AppendLine("---");
                systemPrompt.AppendLine($"Source: {cite.FileName} (Page {cite.PageNumber})");
                systemPrompt.AppendLine($"Content: {cite.Content}");
                systemPrompt.AppendLine("---");
            }

            // 3. Request Chat Completion from Semantic Kernel
            var chatHistory = new ChatHistory();
            chatHistory.AddSystemMessage(systemPrompt.ToString());
            chatHistory.AddUserMessage(question);

            var executionSettings = new OpenAIPromptExecutionSettings
            {
                Temperature = 0.3, // low temperature for high factual accuracy
                MaxTokens = 800
            };

            var chatResult = await _chatService.GetChatMessageContentAsync(chatHistory, executionSettings);
            
            return new RagResponse
            {
                Answer = chatResult.Content ?? string.Empty,
                Citations = citations
            };
        }
    }

    public class SearchResultItem
    {
        public string FileName { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public int PageNumber { get; set; }
        public int ChunkIndex { get; set; }
        public double SimilarityScore { get; set; }
    }

    public class RagResponse
    {
        public string Answer { get; set; } = string.Empty;
        public List<SearchResultItem> Citations { get; set; } = new();
    }
}
