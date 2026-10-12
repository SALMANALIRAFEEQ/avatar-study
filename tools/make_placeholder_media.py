"""Generate placeholder stimuli so the study flow can be tested before the real videos exist.

Makes, in study/media/:
  A_neutral.mp4, A_warm.mp4, B_neutral.mp4, B_warm.mp4   (colored card + label, quiet tone)
  A_neutral.jpg ... B_warm.jpg                           (thumbnails)
  soundcheck.mp3                                         (Windows voice saying the sound check word)

Needs ffmpeg: either on PATH, or `pip install imageio-ffmpeg` (bundles a portable copy).
The voice uses Windows' built-in speech engine (System.Speech), so the sound check part is Windows only.

Usage:  python tools/make_placeholder_media.py [--seconds 10]
Replace these files with the real videos later; keep the same names or update study.config.json.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "study" / "media"
CONFIG = ROOT / "study" / "config" / "study.config.json"

# Distinct but calm colors so testers can tell the four clips apart at a glance.
COLORS = {"A_neutral": "0x4a5a6a", "A_warm": "0xb5653a", "B_neutral": "0x3f5f4f", "B_warm": "0xa8483f"}

FONT_DIR = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
FONT = "arial.ttf"  # ffmpeg runs with cwd=FONT_DIR so the path needs no escaping


def find_ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit("ffmpeg not found. Install it, or run: pip install imageio-ffmpeg")


def run(cmd, cwd=None):
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr[-2000:])
        sys.exit(f"Command failed: {' '.join(map(str, cmd[:6]))} ...")


def make_video(ffmpeg, key, files, product_name, condition, seconds):
    out = MEDIA / Path(files["file"]).name
    product = key.split("_")[0]
    lines = [
        ("PLACEHOLDER VIDEO", 60, "h*0.22"),
        (f"Product {product}, {product_name}", 52, "h*0.40"),  # no colons: they break drawtext
        (f"{condition.upper()} style", 72, "h*0.56"),
        ("%{eif\\:t\\:d} s", 44, "h*0.76"),
    ]
    draw = ",".join(
        f"drawtext=fontfile={FONT}:text='{text}':fontsize={size}:fontcolor=white:x=(w-text_w)/2:y={y}"
        for text, size, y in lines
    )
    run([
        ffmpeg, "-y",
        "-f", "lavfi", "-i", f"color=c={COLORS.get(key, '0x555555')}:s=1280x720:r=30:d={seconds}",
        "-f", "lavfi", "-i", f"sine=frequency=220:sample_rate=44100:duration={seconds}",
        "-vf", draw,
        "-af", "volume=0.08",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "main", "-preset", "veryfast", "-crf", "28",
        "-c:a", "aac", "-b:a", "96k",
        "-movflags", "+faststart",  # metadata at the front so playback starts before the full download
        "-shortest", str(out),
    ], cwd=FONT_DIR)
    run([ffmpeg, "-y", "-ss", "1", "-i", str(out), "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "4",
         str(MEDIA / Path(files["thumb"]).name)])
    print(f"  {out.name}  ({out.stat().st_size // 1024} KB)")


def make_soundcheck(ffmpeg, word, out_name):
    if os.name != "nt":
        print("  Skipping sound check clip (needs Windows speech). Record one yourself.")
        return
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "word.wav"
        ps = (
            "Add-Type -AssemblyName System.Speech;"
            "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;"
            "$s.Rate = -2;"
            f"$s.SetOutputToWaveFile('{wav}');"
            f"$s.Speak('{word}'); $s.Dispose()"
        )
        run(["powershell", "-NoProfile", "-Command", ps])
        out = MEDIA / out_name
        # Short silence before the word so phones don't clip the start.
        run([ffmpeg, "-y", "-i", str(wav), "-af", "adelay=400:all=1,apad=pad_dur=0.8,loudnorm",
             "-ar", "44100", "-ac", "1", "-b:a", "96k", str(out)])
        print(f"  {out.name}  ({out.stat().st_size // 1024} KB)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seconds", type=int, default=10, help="length of each placeholder video")
    args = parser.parse_args()

    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    ffmpeg = find_ffmpeg()
    MEDIA.mkdir(parents=True, exist_ok=True)

    print("Videos:")
    for key, files in config["videos"].items():
        product, condition = key.split("_", 1)
        make_video(ffmpeg, key, files, config["products"][product]["name"], condition, args.seconds)

    print("Sound check:")
    sc = config["sound_check"]
    make_soundcheck(ffmpeg, sc["correct"], Path(sc["file"]).name)


if __name__ == "__main__":
    main()
