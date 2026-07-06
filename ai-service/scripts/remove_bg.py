#!/usr/bin/env python3
"""
Usage: python remove_bg.py --input <path> --output <path>

Uses BiRefNet via rembg for high-quality background removal.
"""
import argparse
import sys
from rembg import remove, new_session
from PIL import Image

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="birefnet-general")
    args = parser.parse_args()

    session = new_session(args.model)
    img = Image.open(args.input)
    out = remove(img, session=session)
    out.save(args.output, "PNG")
    print(f"Saved: {args.output}", flush=True)

if __name__ == "__main__":
    main()
