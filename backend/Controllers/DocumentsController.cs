using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using EnterpriseRagPoc.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace EnterpriseRagPoc.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DocumentsController : ControllerBase
    {
        private readonly PdfIngestionService _pdfIngestionService;
        private readonly NpgsqlDataSource _dataSource;

        public DocumentsController(
            PdfIngestionService pdfIngestionService,
            NpgsqlDataSource dataSource)
        {
            _pdfIngestionService = pdfIngestionService;
            _dataSource = dataSource;
        }

        [HttpPost("upload")]
        [DisableRequestSizeLimit]
        public async Task<IActionResult> UploadPdf(IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("No file was uploaded or file is empty.");
            }

            if (Path.GetExtension(file.FileName).ToLower() != ".pdf")
            {
                return BadRequest("Only PDF documents are supported for ingestion.");
            }

            try
            {
                using var stream = file.OpenReadStream();
                await _pdfIngestionService.IngestPdfAsync(stream, file.FileName);
                return Ok(new { message = $"Document '{file.FileName}' ingested and indexed successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"Failed to ingest document: {ex.Message}" });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetDocuments()
        {
            var documents = new List<DocumentSummary>();

            try
            {
                using var conn = _dataSource.CreateConnection();
                await conn.OpenAsync();

                string sql = @"
                    SELECT file_name, COUNT(*) AS chunks_count, MAX(page_number) AS total_pages
                    FROM rag_documents
                    GROUP BY file_name
                    ORDER BY file_name;";

                using var cmd = new NpgsqlCommand(sql, conn);
                using var reader = await cmd.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    documents.Add(new DocumentSummary
                    {
                        FileName = reader.GetString(0),
                        ChunksCount = reader.GetInt64(1),
                        TotalPages = reader.GetInt32(2)
                    });
                }

                return Ok(documents);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"Failed to fetch documents list: {ex.Message}" });
            }
        }

        [HttpDelete("{fileName}")]
        public async Task<IActionResult> DeleteDocument(string fileName)
        {
            if (string.IsNullOrWhiteSpace(fileName))
            {
                return BadRequest("File name cannot be empty.");
            }

            try
            {
                using var conn = _dataSource.CreateConnection();
                await conn.OpenAsync();

                string sql = "DELETE FROM rag_documents WHERE file_name = @file_name;";
                using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("file_name", fileName);

                int rowsAffected = await cmd.ExecuteNonQueryAsync();

                if (rowsAffected == 0)
                {
                    return NotFound(new { message = $"Document '{fileName}' not found in the vector index." });
                }

                return Ok(new { message = $"Document '{fileName}' and its vector embeddings deleted successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"Failed to delete document: {ex.Message}" });
            }
        }
    }

    public class DocumentSummary
    {
        public string FileName { get; set; } = string.Empty;
        public long ChunksCount { get; set; }
        public int TotalPages { get; set; }
    }
}
