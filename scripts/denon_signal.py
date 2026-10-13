#!/usr/bin/env python3
"""Linwood: read the Denon AVR's live A/V signal info over telnet and print JSON.

Used by the `sensor.theater_av_signal` command_line sensor. Read-only: it only
sends status queries ("... ?"), never commands.
Usage: denon_signal.py <host>   (or set DENON_HOST). The receiver's address is
deliberately not stored in this public repo — pass it from the sensor's command.
"""
import json
import os
import re
import socket
import sys
import time

HOST = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("DENON_HOST")
if not HOST:
    print(json.dumps({"summary": "unavailable", "error": "no receiver host given (argument or DENON_HOST)"}))
    sys.exit(0)
PORT = 23
QUERIES = ["SSINFSIGRES ?", "SSINFSIGHDR ?", "SSINFAISSIG ?", "OPINFINS ?", "SYSDA ?", "MS?"]
CATEGORY = {"01": "Analog", "02": "PCM", "03": "Dolby", "04": "DTS", "05": "MPEG",
            "06": "AAC", "07": "Multi-ch PCM", "08": "Auro-3D", "09": "HEOS"}


def query():
    """Send the status queries and collect every reply line, keyed by prefix."""
    lines = []
    with socket.create_connection((HOST, PORT), timeout=3) as s:
        s.settimeout(0.35)
        buf = b""
        for q in QUERIES:
            s.sendall(q.encode("ascii") + b"\r")
            time.sleep(0.12)
        end = time.time() + 1.6
        while time.time() < end:
            try:
                chunk = s.recv(4096)
                if not chunk:
                    break
                buf += chunk
            except socket.timeout:
                if buf:
                    break
        lines = [ln.strip() for ln in buf.decode("ascii", "ignore").split("\r") if ln.strip()]
    return lines


def pick(lines, prefix):
    """Last reply starting with prefix, prefix stripped (replies can repeat)."""
    val = None
    for ln in lines:
        if ln.startswith(prefix):
            val = ln[len(prefix):].strip()
    return val


def norm_res(v):
    if not v or v.startswith("-"):
        return None, None
    m = re.match(r"^(\d+K|\d+[PI])(\d+(?:\.\d+)?)?", v.upper())
    if not m:
        return v, None
    label = m.group(1)
    label = label if label.endswith("K") else label.lower()  # 4K / 1080p
    return label, m.group(2)


def norm_hdr(v):
    if not v or v.startswith("-"):
        return None
    u = re.sub(r"[\s_]", "", v.upper())
    if u in ("SDR", "OFF", "NONE", "NOHDR"):
        return "SDR"
    if "DOLBY" in u or u.startswith("DV"):
        return "Dolby Vision"
    if "HDR10+" in u or "HDR10PLUS" in u:
        return "HDR10+"
    if "HDR10" in u or u == "HDR":
        return "HDR10"
    if "HLG" in u:
        return "HLG"
    return v


def norm_audio(v):
    if not v:
        return None, False
    u = v.upper()
    if "ATMOS" in u:
        return "Dolby Atmos", True
    if "DTS:X" in u or "DTSX" in u.replace(" ", ""):
        return "DTS:X", True
    if "AURO" in u:
        return "Auro-3D", True
    if "TRUEHD" in u or "TRUE HD" in u:
        return "Dolby TrueHD", False
    if "DIGITAL +" in u or "DIGITAL+" in u or "DD+" in u or "PLUS" in u:
        return "Dolby Digital+", False
    if "DOLBY DIGITAL" in u or u.startswith("DOLBY D"):
        return "Dolby Digital", False
    if "DTS" in u:
        return ("DTS-HD MA" if "MSTR" in u or "MA" in u.split() else "DTS"), False
    if "PCM" in u or "MULTI" in u:
        return "PCM", False
    if "ANALOG" in u:
        return "Analog", False
    return v.strip(), False


def channels(ins):
    """OPINFINS is a per-speaker map: 2 = signal present, 1 = silent, 0 = n/a."""
    if not ins:
        return None, 0
    n = ins.count("2")
    if n == 0:
        return None, 0
    label = {1: "Mono", 2: "Stereo", 3: "2.1", 6: "5.1", 8: "7.1"}.get(n, f"{n - 1}.1")
    return label, n


def main():
    try:
        lines = query()
    except OSError as err:
        print(json.dumps({"summary": "unavailable", "error": str(err)}))
        return
    res_in = pick(lines, "SSINFSIGRES I")
    res_out = pick(lines, "SSINFSIGRES O")
    hdr_raw = pick(lines, "SSINFSIGHDR I")
    sysda = pick(lines, "SYSDA")
    sig = pick(lines, "SSINFAISSIG")
    ins = pick(lines, "OPINFINS")
    ms = pick(lines, "MS")

    res, fps = norm_res(res_in)
    res_o, _ = norm_res(res_out)
    hdr = norm_hdr(hdr_raw) if res else None
    audio, immersive = norm_audio(sysda)
    ch, n = channels(ins)

    parts = [p for p in (res, hdr if hdr and hdr != "SDR" else None, audio if audio != "Analog" else None,
                         None if immersive else ch) if p]
    out = {
        "summary": " · ".join(parts) if parts else "No signal",
        "video_resolution": res, "video_fps": fps, "video_out_resolution": res_o,
        "hdr": hdr, "hdr_raw": hdr_raw,
        "audio_format": audio, "audio_immersive": immersive, "audio_raw": sysda,
        "audio_category": CATEGORY.get(sig or "", sig),
        "channels": ch, "channel_count": n, "channels_raw": ins,
        "sound_mode_raw": ms,
    }
    print(json.dumps(out))


if __name__ == "__main__":
    main()
