from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import AskRequest, AskResponse, DebugInfo, RecommendedAction
from app.settings import settings

app = FastAPI(title="Triaige Runner")

origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest):
    return AskResponse(
        classification="uncertain",
        confidence=0.0,
        rationale="Stub response — agent graph not yet wired.",
        citations=[],
        recommended_action=RecommendedAction(
            type="request_human_review",
            executed=False,
            url=None,
        ),
        tool_calls=[],
        image_diff=None,
        vision_summary=None,
        debug=DebugInfo(intent="triage", errors=[]),
    )
