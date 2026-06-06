using System;
using System.Threading.Tasks;
using EnterpriseRagPoc.Services;
using Microsoft.AspNetCore.Mvc;

namespace EnterpriseRagPoc.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ChatController : ControllerBase
    {
        private readonly RagService _ragService;

        public ChatController(RagService ragService)
        {
            _ragService = ragService;
        }

        [HttpPost("search")]
        public async Task<IActionResult> Search([FromBody] SearchRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Query))
            {
                return BadRequest("Search query cannot be empty.");
            }

            try
            {
                var results = await _ragService.SearchSimilarChunksAsync(request.Query, request.Limit);
                return Ok(results);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"Failed to execute semantic search: {ex.Message}" });
            }
        }

        [HttpPost("ask")]
        public async Task<IActionResult> Ask([FromBody] AskRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Question))
            {
                return BadRequest("Question cannot be empty.");
            }

            try
            {
                var response = await _ragService.AskQuestionAsync(request.Question);
                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"Failed to get answer: {ex.Message}" });
            }
        }
    }

    public class SearchRequest
    {
        public string Query { get; set; } = string.Empty;
        public int? Limit { get; set; }
    }

    public class AskRequest
    {
        public string Question { get; set; } = string.Empty;
    }
}
