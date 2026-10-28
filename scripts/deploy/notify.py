#!/usr/bin/env python3
"""Trello card + optional SMTP email for deploy notify (manual / failure / success)."""
from __future__ import annotations

import json
import os
import smtplib
import sys
import urllib.error
import urllib.parse
import urllib.request
from email.mime.text import MIMEText


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def post_trello(title: str, desc: str) -> str | None:
    key = env("TRELLO_KEY")
    token = env("TRELLO_TOKEN")
    list_id = env("TRELLO_LIST_ID")
    if not (key and token and list_id):
        print("Trello: secrets hiányoznak, kihagyva.", file=sys.stderr)
        return None
    data = urllib.parse.urlencode(
        {
            "key": key,
            "token": token,
            "idList": list_id,
            "name": title[:16384],
            "desc": desc[:16384],
        }
    ).encode()
    req = urllib.request.Request(
        "https://api.trello.com/1/cards",
        data=data,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode())
            card_id = body.get("id")
            print(f"Trello card created: {body.get('shortUrl', card_id)}")
            return card_id
    except urllib.error.HTTPError as e:
        print(f"Trello HTTP error: {e.read().decode()}", file=sys.stderr)
        return None


def move_trello_card(card_id: str, list_id: str) -> None:
    key = env("TRELLO_KEY")
    token = env("TRELLO_TOKEN")
    if not (key and token and card_id and list_id):
        return
    data = urllib.parse.urlencode(
        {"key": key, "token": token, "idList": list_id}
    ).encode()
    req = urllib.request.Request(
        f"https://api.trello.com/1/cards/{card_id}",
        data=data,
        method="PUT",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        urllib.request.urlopen(req, timeout=30)
        print(f"Trello card moved to list {list_id}")
    except urllib.error.HTTPError as e:
        print(f"Trello move failed: {e.read().decode()}", file=sys.stderr)


def send_email(subject: str, body: str) -> None:
    host = env("SMTP_HOST")
    port = int(env("SMTP_PORT", "587"))
    user = env("SMTP_USER")
    password = env("SMTP_PASS")
    mail_from = env("SMTP_FROM", user)
    mail_to = env("SMTP_TO")
    if not (host and mail_to):
        print("SMTP: nincs beállítva, kihagyva.", file=sys.stderr)
        return
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = mail_from
    msg["To"] = mail_to
    with smtplib.SMTP(host, port, timeout=30) as smtp:
        smtp.ehlo()
        if env("SMTP_TLS", "1") == "1":
            smtp.starttls()
        if user and password:
            smtp.login(user, password)
        smtp.sendmail(mail_from, [mail_to], msg.as_string())
    print(f"Email sent to {mail_to}")


def main() -> int:
    action = env("NOTIFY_ACTION", "manual")
    title = env("NOTIFY_TITLE", "Deploy: manual step required")
    body = env("NOTIFY_BODY") or sys.stdin.read()
    run_url = env("GITHUB_SERVER_URL", "https://github.com") + "/" + env(
        "GITHUB_REPOSITORY", ""
    ) + "/actions/runs/" + env("GITHUB_RUN_ID", "")
    sha = env("GITHUB_SHA", "")[:7]
    full_desc = f"{body}\n\nCommit: `{sha}`\nRun: {run_url}\n"

    if action in ("manual", "failure"):
        card_id = post_trello(title, full_desc)
        if card_id:
            with open(os.environ.get("GITHUB_OUTPUT", "/dev/null"), "a") as out:
                if os.environ.get("GITHUB_OUTPUT"):
                    out.write(f"trello_card_id={card_id}\n")
        send_email(title, full_desc)
    elif action == "success":
        card_id = env("TRELLO_CARD_ID")
        done_list = env("TRELLO_DONE_LIST_ID")
        if card_id and done_list:
            move_trello_card(card_id, done_list)
        elif card_id:
            # Archive by moving to same list with comment — close via API
            key, token = env("TRELLO_KEY"), env("TRELLO_TOKEN")
            if key and token:
                data = urllib.parse.urlencode(
                    {"key": key, "token": token, "closed": "true"}
                ).encode()
                req = urllib.request.Request(
                    f"https://api.trello.com/1/cards/{card_id}",
                    data=data,
                    method="PUT",
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                try:
                    urllib.request.urlopen(req, timeout=30)
                    print("Trello card closed.")
                except urllib.error.HTTPError:
                    pass
        send_email(title, full_desc)
    else:
        print(f"Unknown NOTIFY_ACTION={action}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
