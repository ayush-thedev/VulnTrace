import json
import logging
from typing import Type, TypeVar, Optional, Dict, Any
from pydantic import BaseModel
from backend.app.config import settings

logger = logging.getLogger("vulntrace.groq")

T = TypeVar("T", bound=BaseModel)

class GroqStructuredClient:
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.GROQ_API_KEY
        self.model = model or settings.GROQ_MODEL
        self._groq_client = None

        if self.api_key and self.api_key.strip():
            try:
                from groq import Groq
                self._groq_client = Groq(api_key=self.api_key.strip())
            except Exception as e:
                logger.warning(f"Failed to initialize Groq client: {e}")

    @property
    def is_configured(self) -> bool:
        return self._groq_client is not None

    def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
        mock_response: Optional[Dict[str, Any]] = None
    ) -> T:
        """
        Generates a validated structured response conforming to response_model.
        Uses Groq API with JSON schema enforcement, or falls back to recorded fixture.
        """
        if self._groq_client and not settings.OFFLINE_FIXTURE_MODE:
            try:
                # Groq Chat Completion with JSON mode
                completion = self._groq_client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": f"{system_prompt}\nYou MUST output valid JSON matching this schema: {json.dumps(response_model.model_json_schema())}"},
                        {"role": "user", "content": user_prompt}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.0
                )
                raw_json = completion.choices[0].message.content
                data = json.loads(raw_json)
                return response_model.model_validate(data)
            except Exception as e:
                logger.warning(f"Groq API call failed or schema validation failed ({e}); checking mock fallback.")

        # Fallback to mock / recorded fixture
        if mock_response is not None:
            return response_model.model_validate(mock_response)

        raise RuntimeError("Groq API key not configured and no mock fallback provided.")

groq_client = GroqStructuredClient()
