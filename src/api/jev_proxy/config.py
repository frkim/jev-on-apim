"""Runtime configuration for the Jev proxy."""

from __future__ import annotations

import os
from dataclasses import dataclass

VERSION = "1.0.0"


class SettingsError(RuntimeError):
    """Raised when APIM mode is selected but required settings are missing."""


@dataclass(frozen=True, slots=True)
class Settings:
    apim_gateway_url: str | None
    apim_subscription_key: str | None
    mock_mode: bool

    @property
    def apim_configured(self) -> bool:
        return bool(self.apim_gateway_url and self.apim_subscription_key)

    @property
    def gateway_mode(self) -> str:
        return "mock" if self.mock_mode or not self.apim_gateway_url else "apim"

    def require_apim(self) -> tuple[str, str]:
        if not self.apim_gateway_url:
            raise SettingsError("APIM_GATEWAY_URL is not configured")
        if not self.apim_subscription_key:
            raise SettingsError("APIM_SUBSCRIPTION_KEY is not configured")
        return self.apim_gateway_url.rstrip("/"), self.apim_subscription_key


def _optional_env(name: str) -> str | None:
    value = os.getenv(name)
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def get_settings() -> Settings:
    return Settings(
        apim_gateway_url=_optional_env("APIM_GATEWAY_URL"),
        apim_subscription_key=_optional_env("APIM_SUBSCRIPTION_KEY"),
        mock_mode=(os.getenv("JEV_MOCK_MODE", "").strip().lower() == "true"),
    )
