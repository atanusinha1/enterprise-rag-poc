using System;
using Npgsql;

namespace EnterpriseRagPoc.Database
{
    public class DbInitializer
    {
        private readonly NpgsqlDataSource _dataSource;

        public DbInitializer(NpgsqlDataSource dataSource)
        {
            _dataSource = dataSource;
        }

        public void Initialize()
        {
            try
            {
                using var conn = _dataSource.CreateConnection();
                conn.Open();

                // 1. Create vector extension if not exists
                using (var cmd = new NpgsqlCommand("CREATE EXTENSION IF NOT EXISTS vector;", conn))
                {
                    cmd.ExecuteNonQuery();
                }

                // Force connection to reload type definitions after creating the extension
                conn.ReloadTypes();

                // 2. Create the document chunk table
                string createTableSql = @"
                    CREATE TABLE IF NOT EXISTS rag_documents (
                        id SERIAL PRIMARY KEY,
                        file_name VARCHAR(255) NOT NULL,
                        content TEXT NOT NULL,
                        page_number INT NOT NULL,
                        chunk_index INT NOT NULL,
                        embedding VECTOR(1536) NOT NULL
                    );";
                
                using (var cmd = new NpgsqlCommand(createTableSql, conn))
                {
                    cmd.ExecuteNonQuery();
                }

                // 3. Create HNSW index for fast similarity search
                string createIndexSql = @"
                    CREATE INDEX IF NOT EXISTS idx_rag_documents_embedding 
                    ON rag_documents USING hnsw (embedding vector_cosine_ops);";

                using (var cmd = new NpgsqlCommand(createIndexSql, conn))
                {
                    cmd.ExecuteNonQuery();
                }

                Console.WriteLine("Database initialized successfully: Table 'rag_documents' and HNSW index created.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error initializing database: {ex.Message}");
                throw;
            }
        }
    }
}
