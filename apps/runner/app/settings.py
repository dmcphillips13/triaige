from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Qdrant
    qdrant_url: str | None = None
    qdrant_api_key: str | None = None
    qdrant_collection: str = "triaige_triage_memory"

    # OpenAI
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    openai_vision_model: str = "gpt-4o"
    openai_embeddings_model: str = "text-embedding-3-small"
    openai_embeddings_dimensions: int = 1536

    # GitHub
    github_token: str | None = None
    github_app_id: str | None = None
    github_app_private_key: str | None = None

    # LangSmith
    langsmith_api_key: str | None = None
    langsmith_project: str = "triaige"
    langchain_tracing_v2: str | None = None

    # Database
    database_url: str = "postgresql://localhost:5432/triaige"

    # API key (shared secret between dashboard and runner)
    api_key: str | None = None

    # Dashboard
    dashboard_url: str = "http://localhost:3000"

    # CORS
    cors_origins: str = "*"


settings = Settings()
