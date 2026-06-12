"""OpenAI-shaped error responses per contracts/asr-shim.md (AS-6).

Shape: {"error": {"message": str, "type": str, "code": str|null}}
"""

from __future__ import annotations

from fastapi.responses import JSONResponse


def error_response(
    status_code: int, message: str, error_type: str, code: str | None = None
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"message": message, "type": error_type, "code": code}},
    )


def invalid_request(message: str, code: str | None = None) -> JSONResponse:
    return error_response(400, message, "invalid_request_error", code)


def server_error(message: str) -> JSONResponse:
    return error_response(500, message, "server_error", None)
