from __future__ import annotations
import os
import smtplib
import ssl
import logging
from dataclasses import dataclass
from email.message import EmailMessage


@dataclass
class SmtpConfig:
    host: str
    port: int
    user: str | None = None
    password: str | None = None
    use_tls: bool = True
    use_ssl: bool = False
    from_email: str | None = None
    from_name: str | None = None


class EmailSender:
    def __init__(self, cfg: SmtpConfig | None) -> None:
        self.cfg = cfg
        self._log = logging.getLogger(__name__)

    @property
    def enabled(self) -> bool:
        return self.cfg is not None and bool(self.cfg.host) and bool(self.cfg.port)

    def send(self, to_email: str, subject: str, text_body: str, html_body: str | None = None) -> bool:
        if not self.enabled:
            self._log.info("EmailSender disabled; skipping send to %s", to_email)
            return False
        assert self.cfg is not None
        msg = EmailMessage()
        from_email = self.cfg.from_email or (self.cfg.user or "no-reply@example.com")
        if self.cfg.from_name:
            msg["From"] = f"{self.cfg.from_name} <{from_email}>"
        else:
            msg["From"] = from_email
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.set_content(text_body)
        if html_body:
            msg.add_alternative(html_body, subtype="html")

        try:
            if self.cfg.use_ssl:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(self.cfg.host, self.cfg.port, context=context) as server:
                    if self.cfg.user and self.cfg.password:
                        server.login(self.cfg.user, self.cfg.password)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(self.cfg.host, self.cfg.port) as server:
                    if self.cfg.use_tls:
                        server.starttls(context=ssl.create_default_context())
                    if self.cfg.user and self.cfg.password:
                        server.login(self.cfg.user, self.cfg.password)
                    server.send_message(msg)
            return True
        except Exception as exc:
            self._log.exception("Error sending email to %s: %s", to_email, exc)
            return False

    def send_verification(self, to_email: str, to_name: str, token: str) -> bool:
        base_url = os.environ.get("PUBLIC_BASE_URL") or os.environ.get("FRONTEND_URL") or os.environ.get("BACKEND_PUBLIC_URL") or ""
        confirm_link = f"{base_url}/api/auth/confirmar?token={token}" if base_url else None
        subject = "Código de verificación - Patitas y Bigotes"
        lines = [
            f"Hola {to_name},",
            "",
            "Usá este código para confirmar tu cuenta:",
            f"",  # blank line
            f"    {token}",
            "",
        ]
        if confirm_link:
            lines += [
                "O hacé clic en el siguiente enlace:",
                confirm_link,
                "",
            ]
        lines += [
            "Si no intentaste registrarte, podés ignorar este mensaje.",
        ]
        text_body = "\n".join(lines)

        html_body = None
        try:
            html_body = (
                f"<p>Hola {to_name},</p>"
                f"<p>Usá este código para confirmar tu cuenta:</p>"
                f"<p style='font-size:22px;font-weight:bold;letter-spacing:2px'>{token}</p>"
                + (f"<p>O hacé clic en el siguiente enlace:<br><a href='{confirm_link}'>{confirm_link}</a></p>" if confirm_link else "")
                + "<p>Si no intentaste registrarte, podés ignorar este mensaje.</p>"
            )
        except Exception:
            # fallback to text only
            html_body = None

        return self.send(to_email, subject, text_body, html_body)


def build_email_sender_from_env() -> EmailSender:
    # Enable only if SMTP_HOST present or EMAIL_ENABLED=1 with enough data
    email_enabled = os.environ.get("EMAIL_ENABLED") == "1"
    host = os.environ.get("SMTP_HOST")
    port_str = os.environ.get("SMTP_PORT")
    user = os.environ.get("SMTP_USER") or os.environ.get("SMTP_USERNAME")
    password = os.environ.get("SMTP_PASS") or os.environ.get("SMTP_PASSWORD")
    use_tls = (os.environ.get("SMTP_TLS", "1") != "0")
    use_ssl = (os.environ.get("SMTP_SSL", "0") == "1")
    from_email = os.environ.get("FROM_EMAIL")
    from_name = os.environ.get("FROM_NAME") or "Patitas y Bigotes"

    cfg: SmtpConfig | None
    if host and (port_str and port_str.isdigit()):
        cfg = SmtpConfig(
            host=host,
            port=int(port_str),
            user=user,
            password=password,
            use_tls=use_tls,
            use_ssl=use_ssl,
            from_email=from_email,
            from_name=from_name,
        )
    elif email_enabled and host and port_str and port_str.isdigit():
        cfg = SmtpConfig(host=host, port=int(port_str))
    else:
        cfg = None
    return EmailSender(cfg)

