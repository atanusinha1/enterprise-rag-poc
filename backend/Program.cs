using EnterpriseRagPoc.Database;
using EnterpriseRagPoc.Services;
using Microsoft.SemanticKernel;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

// 1. Add API Controllers & Swagger
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 2. Configure CORS for React Frontend (typically runs on port 5173 for Vite)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// 3. Register Semantic Kernel services via Dependency Injection
var azureOpenAiSection = builder.Configuration.GetSection("AzureOpenAI");
string endpoint = azureOpenAiSection["Endpoint"] ?? string.Empty;
string apiKey = azureOpenAiSection["ApiKey"] ?? string.Empty;
string embeddingDeployment = azureOpenAiSection["EmbeddingDeploymentName"] ?? "text-embedding-3-small";
string chatDeployment = azureOpenAiSection["ChatDeploymentName"] ?? "gpt-4o";

// Register the Kernel and Azure OpenAI connections
builder.Services.AddKernel();
builder.Services.AddAzureOpenAITextEmbeddingGeneration(embeddingDeployment, endpoint, apiKey);
builder.Services.AddAzureOpenAIChatCompletion(chatDeployment, endpoint, apiKey);

// Register NpgsqlDataSource with pgvector support
string postgresConnectionString = builder.Configuration.GetConnectionString("PostgresConnection") 
    ?? throw new InvalidOperationException("PostgresConnection connection string is missing.");
var dataSourceBuilder = new NpgsqlDataSourceBuilder(postgresConnectionString);
dataSourceBuilder.UseVector();
var dataSource = dataSourceBuilder.Build();
builder.Services.AddSingleton(dataSource);

// 4. Register Custom Services
builder.Services.AddSingleton<DbInitializer>();
builder.Services.AddTransient<PdfIngestionService>();
builder.Services.AddTransient<RagService>();

var app = builder.Build();

// 5. Initialize the Database (Runs migrations/schema setup on startup)
using (var scope = app.Services.CreateScope())
{
    try
    {
        var dbInitializer = scope.ServiceProvider.GetRequiredService<DbInitializer>();
        dbInitializer.Initialize();
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "An error occurred while initializing the pgvector database.");
    }
}

// 6. Configure HTTP Request Pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Enable CORS using the policy we defined
app.UseCors("AllowReactApp");

app.UseAuthorization();

app.MapControllers();

app.Run();
