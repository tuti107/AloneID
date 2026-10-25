#!/usr/bin/env python3
"""Cuts the trailer together as edit.json lays it out and encodes
tools/trailer/out/trailer.mp4 (1920x1080, 24 fps, H.264 + AAC).

Inputs: out/shots/<id>/NNNN.png + <id>.wav (capture.cjs), out/score.wav
(score.cjs) and the title cards in cards/. Shots are drawn at 960x540 and
doubled with nearest-neighbour so the pixels stay square and sharp. The
sound is the shots' own effects and ambience under the score, brought to
-16 LUFS with a peak limiter. Needs Pillow, numpy and ffmpeg.
"""
import json
import os
import re
import subprocess
import wave

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
SHOTS = os.path.join(OUT, 'shots')
W, H, SR = 1920, 1080, 48000
CARD_FADE = 0.3
SFX_GAIN, SCORE_GAIN = 1.0, 1.4
LOUDNESS = -16.0

edit = json.load(open(os.path.join(HERE, 'edit.json')))
FPS = edit['fps']
beats, t = [], 0.0
for b in edit['beats']:
    b = dict(b, start=t)
    b['label'] = b.get('label') or b.get('shot') or b.get('card') or ('black' if b.get('black') else '?')
    t += b['dur']
    beats.append(b)
TOTAL = t


def read_wav(path):
    with wave.open(path) as w:
        assert w.getframerate() == SR and w.getnchannels() == 2
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).astype(np.float32) / 32768


def write_wav(path, x):
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def ramp(n, up=True):
    r = np.sin(np.linspace(0, np.pi / 2, max(n, 1))) ** 2
    return r if up else r[::-1]


# ---------------------------------------------------------------- sound
def mix_audio():
    n = int((TOTAL + 1) * SR)
    sfx = np.zeros((n, 2), np.float32)
    cache = {}

    def place(src, s0, s1, at, fade_in, fade_out, gain, stop=None):
        """Lay src[s0:s1] (seconds) at `at`, cut at `stop` (seconds) if given."""
        a, b = int(s0 * SR), int(s1 * SR)
        a0 = max(a, 0)
        seg = src[a0:b] * gain
        i = int(at * SR) + (a0 - a)
        if stop is not None:
            seg = seg[:max(0, int(stop * SR) - i)]
        if not len(seg):
            return
        fi, fo = min(len(seg), int(fade_in * SR)), min(len(seg), int(fade_out * SR))
        seg[:fi] *= ramp(fi)[:, None]
        if fo:
            seg[-fo:] *= ramp(fo, False)[:, None]
        m = min(len(seg), n - i)
        sfx[i:i + m] += seg[:m]

    for k, b in enumerate(beats):
        nxt = beats[k + 1] if k + 1 < len(beats) else None
        quiet_next = nxt is not None and (nxt.get('silent') or nxt.get('nosfx'))
        stop = b['start'] + b['dur'] if quiet_next else None
        src_id = b.get('shot') or b.get('bed')
        if not src_id:
            continue
        if src_id not in cache:
            cache[src_id] = read_wav(os.path.join(SHOTS, src_id + '.wav'))
        src, gain = cache[src_id], 10 ** (b.get('gain', 0) / 20)
        if b.get('bed'):
            place(src, 0.2, 0.2 + b['dur'] + 1.0, b['start'], 0.8, 1.0, gain, stop)
            continue
        lead = min(b.get('lead', 0.0), b['in'])
        # cut sharply into another shot; let the room die away under a title card
        tail = 0.02 if quiet_next else 1.0 if nxt is not None and nxt.get('card') else 0.35
        place(src, b['in'] - lead, b['in'] + b['dur'] + tail, b['start'] - lead,
              lead if lead else 0.015, tail, gain, stop)

    score = read_wav(os.path.join(OUT, 'score.wav'))[:n]
    score = np.pad(score, ((0, n - len(score)), (0, 0)))
    # dead silence where the cut asks for it (the score's reverb tails included)
    for b in beats:
        if b.get('silent'):
            a, z = int(b['start'] * SR), int((b['start'] + b['dur']) * SR)
            f = int(0.02 * SR)
            for x in (sfx, score):
                x[a - f:a] *= ramp(f, False)[:, None]
                x[a:z] = 0
                x[z:z + f] *= ramp(f)[:, None]
    mix = (sfx * SFX_GAIN + score * SCORE_GAIN)[:int(TOTAL * SR)]
    end = int(1.2 * SR)
    mix[-end:] *= ramp(end, False)[:, None]
    # headroom for the 16-bit file; loudness and peaks are set in ffmpeg
    mix *= 0.5 / max(0.5, float(np.abs(mix).max()))
    path = os.path.join(OUT, 'mix.wav')
    write_wav(path, mix)
    return path


def loudness(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-map', '0:a', '-af', 'ebur128=peak=true',
                        '-f', 'null', '-'], capture_output=True, text=True).stderr
    summary = r[r.rfind('Summary:'):]
    i = float(re.search(r'I:\s+(-?[\d.]+) LUFS', summary).group(1))
    p = float(re.search(r'Peak:\s+(-?[\d.]+) dBFS', summary).group(1))
    return i, p


# ---------------------------------------------------------------- picture
_cards, _frames = {}, {}


def card(name):
    if name not in _cards:
        _cards[name] = np.asarray(Image.open(os.path.join(HERE, 'cards', name + '.png')).convert('RGB'), np.float32)
    return _cards[name]


def shot_frame(sid, i):
    d = os.path.join(SHOTS, sid)
    if sid not in _frames:
        _frames[sid] = len([f for f in os.listdir(d) if f.endswith('.png')])
    i = max(0, min(i, _frames[sid] - 1))
    im = Image.open(os.path.join(d, f'{i:04d}.png')).convert('RGB').resize((W, H), Image.NEAREST)
    return np.array(im, np.float32)


LOGO = Image.open(os.path.join(HERE, 'cards', 'logo_transparent.png')).convert('RGBA')
LOGO_RGB = np.asarray(LOGO, np.float32)[..., :3]
LOGO_A = np.asarray(LOGO, np.float32)[..., 3:] / 255
LOGO_XY = ((W - LOGO.width) // 2, 760)
BAND = np.clip(1 - np.abs(np.linspace(-1, 1, LOGO.height + 160)) ** 2, 0, 1)[:, None, None]


def frame(k):
    tt = k / FPS
    b = next((x for x in beats if x['start'] <= tt + 1e-6 < x['start'] + x['dur']), beats[-1])
    lt = tt - b['start']
    if b.get('black'):
        return np.zeros((H, W, 3), np.float32)
    if b.get('card'):
        a = min(1.0, lt / CARD_FADE, (b['dur'] - lt) / CARD_FADE)
        return card(b['card']) * max(0.0, a)
    img = shot_frame(b['shot'], round((b['in'] + lt) * FPS))
    if 'logo' in b and lt >= b['logo']:
        a = min(1.0, (lt - b['logo']) / 1.2)
        x, y = LOGO_XY
        # a soft dark band behind the logo, then the logo itself
        img[y - 80:y + LOGO.height + 80] *= 1 - 0.45 * a * BAND
        region = img[y:y + LOGO.height, x:x + LOGO.width]
        img[y:y + LOGO.height, x:x + LOGO.width] = region * (1 - LOGO_A * a) + LOGO_RGB * LOGO_A * a
    return img


def master(wav):
    """Bring the mix to LOUDNESS under a peak limiter; AAC in out/audio.m4a."""
    path = os.path.join(OUT, 'audio.m4a')
    i, _ = loudness(wav)
    gain = LOUDNESS - i
    for _ in range(3):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav,
                        '-af', f'volume={gain:.2f}dB,alimiter=limit=0.7:attack=4:release=80:level=disabled',
                        '-c:a', 'aac', '-b:a', '192k', path], check=True)
        i2, p2 = loudness(path)
        if abs(i2 - LOUDNESS) < 0.3:
            break
        gain += LOUDNESS - i2
    return path, i2, p2


def main():
    wav = mix_audio()
    audio, lufs, peak = master(wav)
    print(f'sound: {TOTAL:.1f} s, {lufs:.1f} LUFS, true peak {peak:.1f} dBTP')
    nf = round(TOTAL * FPS)
    video = os.path.join(OUT, 'picture.mp4')
    enc = subprocess.Popen([
        'ffmpeg', '-v', 'error', '-y',
        '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', video,
    ], stdin=subprocess.PIPE)
    for k in range(nf):
        enc.stdin.write(np.clip(frame(k), 0, 255).astype(np.uint8).tobytes())
    enc.stdin.close()
    enc.wait()
    out = os.path.join(OUT, 'trailer.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-i', audio, '-map', '0:v', '-map', '1:a',
                    '-c', 'copy', '-shortest', '-movflags', '+faststart', out], check=True)
    print(f'{out}: {nf} frames, {os.path.getsize(out) / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
