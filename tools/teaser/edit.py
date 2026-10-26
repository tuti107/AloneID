#!/usr/bin/env python3
"""Cut the 15-second live-action-style teaser from the Runway material.

usage: python3 tools/teaser/edit.py <work dir> [out.mp4]

The work dir holds what Runway made (see shots.json for the task IDs):
  clips/s1_mansion.mp4 … s6_lantern.mp4   gen-4.5, 1280x720, 24 fps
  audio/music.mp3 thunder.mp3 splash.mp3 whisper.mp3 roar.mp3
  fonts/ShipporiMincho-Bold.ttf ShipporiMincho-Medium.ttf Cinzel-SemiBold.ttf
"""
import os
import re
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS, LENGTH = 1920, 1080, 24, 15.0
LUFS, PEAK = -16.0, -2.2

# timeline: (clip, source in, source out) laid end to end
SHOTS = [
    ('s1_mansion', 0.00, 2.75),   # 0.00  storm, lightning, the house on the cliff
    ('s2_edgar', 0.30, 2.55),     # 2.75  Edgar lifts the lantern, looks back (the clip cuts away at 2.9)
    ('s3_sailor', 3.40, 4.80),    # 5.00  the drowned sailor lunges at the lens
    ('s4_captain', 1.40, 4.70),   # 6.40  Ezekiel raises his cutlass, the star in his chest blazes
    ('s5_abyss', 0.30, 2.10),     # 9.70  the god behind Clara on the altar
    ('s6_lantern', 1.05, 1.55),   # 11.50 the flame flares …
]
TITLE_AT = 12.0                   # … into the title, on the score's impact
TITLE_BG = ('s6_lantern', 2.0, 5.0)

# sound: (file, start time, gain)
SOUNDS = [
    ('thunder', 0.0, 1.0),
    ('splash', 5.0, 0.9),
    ('whisper', 6.65, 2.3),
    ('roar', 9.7, 0.95),
]

# text layers: (name, fade in at, fade out at or None)
TEXTS = [
    ('year', 0.45, 2.25),
    ('tag', 6.85, 9.2),
    ('title', TITLE_AT + 0.05, None),
    ('subtitle', TITLE_AT + 0.6, None),
    ('line', TITLE_AT + 1.2, None),
]


def card(path, lines, band=False):
    """A transparent frame-sized layer of centred lines with a soft shadow,
    over a dark band rising from the foot of the frame if asked."""
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    if band:
        g = ImageDraw.Draw(layer)
        for y in range(H // 2, H):
            g.line([(0, y), (W, y)], fill=(0, 0, 0, int(175 * ((y - H // 2) / (H // 2)) ** 1.3)))
    text = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dt, ds = ImageDraw.Draw(text), ImageDraw.Draw(shadow)
    for words, font, y, color, spacing in lines:
        width = sum(dt.textlength(ch, font=font) for ch in words) + spacing * (len(words) - 1)
        x = (W - width) / 2
        for ch in words:
            ds.text((x + 3, y + 4), ch, font=font, fill=(0, 0, 0, 235))
            dt.text((x, y), ch, font=font, fill=color)
            x += dt.textlength(ch, font=font) + spacing
    layer = Image.alpha_composite(layer, shadow.filter(ImageFilter.GaussianBlur(9)))
    Image.alpha_composite(layer, text).save(path)


def make_cards(work, out):
    f = lambda name, size: ImageFont.truetype(os.path.join(work, 'fonts', name), size)
    bold, medium, cinzel = 'ShipporiMincho-Bold.ttf', 'ShipporiMincho-Medium.ttf', 'Cinzel-SemiBold.ttf'
    paper = (238, 228, 206, 255)
    card(f'{out}/year.png', [('一九二四年、冬。', f(medium, 66), 828, paper, 12),
                             ('マサチューセッツ州　ブラックポート', f(medium, 34), 922, (214, 205, 184, 255), 7)], band=True)
    card(f'{out}/tag.png', [('あれを、火に還せ。', f(bold, 78), 838, paper, 14)], band=True)
    card(f'{out}/title.png', [('ASHCOMBE HOUSE', f(cinzel, 150), 330, (226, 210, 176, 255), 12)])
    card(f'{out}/subtitle.png', [('― 闇にひとり ―', f(bold, 92), 545, (200, 46, 36, 255), 18)])
    card(f'{out}/line.png', [('ブラウザで遊べる、固定カメラのサバイバルホラー', f(medium, 40), 760, (210, 200, 178, 255), 4)])


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


def mix_sound(work, wav):
    """The score, ducked under the whisper, with the effects on their cuts,
    brought to the target loudness under a true-peak ceiling."""
    fmt = 'aformat=sample_rates=48000:channel_layouts=stereo'
    inputs = ['-i', os.path.join(work, 'audio', 'music.mp3')]
    graph = [f'[0:a]{fmt},atrim=0:{LENGTH},asetpts=PTS-STARTPTS,apad=whole_dur={LENGTH},volume=0.9[mus]']
    music, mix = 'mus', []
    for j, (name, t, gain) in enumerate(SOUNDS):
        inputs += ['-i', os.path.join(work, 'audio', name + '.mp3')]
        ms = int(t * 1000)
        # every stem runs the whole length, so nothing downstream ends early
        graph.append(f'[{j + 1}:a]{fmt},volume={gain},adelay={ms}|{ms},apad=whole_dur={LENGTH}[d{j}]')
        if name == 'whisper':
            graph.append(f'[d{j}]asplit[s{j}][key]')
            graph.append(f'[{music}][key]sidechaincompress=threshold=0.02:ratio=8:attack=30:release=450[musd]')
            music = 'musd'
        else:
            graph.append(f'[d{j}]anull[s{j}]')
        mix.append(f'[s{j}]')
    graph.append(f'[{music}]{"".join(mix)}amix=inputs={len(mix) + 1}:normalize=0:duration=longest,atrim=0:{LENGTH}[raw]')
    raw = wav + '.raw.wav'
    run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', ';'.join(graph), '-map', '[raw]', '-c:a', 'pcm_s24le', raw])
    meas = run(['ffmpeg', '-nostats', '-i', raw, '-af', 'ebur128', '-f', 'null', '-']).stderr
    loud = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', meas)[-1])
    gain = LUFS - loud
    limit = 10 ** (PEAK / 20)
    run(['ffmpeg', '-y', '-v', 'error', '-i', raw, '-af',
         f'volume={gain:.2f}dB,alimiter=limit={limit:.3f}:attack=2:release=60:level=disabled,afade=t=out:st={LENGTH - 0.5}:d=0.5',
         '-c:a', 'pcm_s24le', wav])
    os.remove(raw)
    return loud, gain


def main():
    work = os.path.abspath(sys.argv[1])
    out = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else os.path.join(work, 'teaser.mp4'))
    layers = os.path.join(work, 'layers')
    os.makedirs(layers, exist_ok=True)
    make_cards(work, layers)
    wav = os.path.join(layers, 'mix.wav')
    loud, gain = mix_sound(work, wav)
    print(f'sound: {loud:.1f} LUFS before, {gain:+.1f} dB to {LUFS} LUFS')

    inputs, graph = [], []
    clip = lambda name: os.path.join(work, 'clips', name + '.mp4')
    grade = ('scale=%d:%d:flags=lanczos,fps=%d,setsar=1,'
             'eq=contrast=1.07:brightness=-0.015:saturation=0.86,'
             'colorbalance=rs=-0.03:bs=0.04:rh=0.03:bh=-0.03,unsharp=5:5:0.35' % (W, H, FPS))
    # the shots, cut and graded alike
    for i, (name, a, b) in enumerate(SHOTS):
        inputs += ['-i', clip(name)]
        graph.append(f'[{i}:v]trim=start={a}:end={b},setpts=PTS-STARTPTS,{grade}[v{i}]')
    # the title's ground: the lantern's glow, far out of focus and low
    n = len(SHOTS)
    name, a, b = TITLE_BG
    inputs += ['-i', clip(name)]
    graph.append(f'[{n}:v]trim=start={a}:end={b},setpts=PTS-STARTPTS,{grade},'
                 f'scale=iw*1.3:ih*1.3,crop={W}:{H}:(iw-{W})/2:(ih-{H})/2+120,'
                 f'gblur=sigma=70,eq=brightness=-0.13:saturation=0.7:gamma=0.8[vt]')
    cat = ''.join(f'[v{i}]' for i in range(n)) + '[vt]'
    graph.append(f'{cat}concat=n={n + 1}:v=1:a=0,trim=duration={LENGTH},vignette=PI/5[base]')
    # a warm flash as the flame blooms into the title
    graph.append(f'color=c=0xfff0d8:s={W}x{H}:r={FPS}:d=0.4,format=rgba,fade=t=out:st=0:d=0.4:alpha=1,setpts=PTS+{TITLE_AT}/TB[flash]')
    graph.append('[base][flash]overlay=eof_action=pass[v]')
    last = 'v'
    k = n + 1
    for name, t_in, t_out in TEXTS:
        inputs += ['-loop', '1', '-t', str(LENGTH), '-i', os.path.join(layers, name + '.png')]
        fades = f'fade=t=in:st={t_in}:d=0.5:alpha=1'
        if t_out is not None:
            fades += f',fade=t=out:st={t_out}:d=0.4:alpha=1'
        graph.append(f'[{k}:v]format=rgba,{fades}[t{k}]')
        graph.append(f'[{last}][t{k}]overlay=0:0[o{k}]')
        last = f'o{k}'
        k += 1
    graph.append(f'[{last}]fade=t=in:st=0:d=0.35,fade=t=out:st={LENGTH - 0.45}:d=0.45,noise=alls=4:allf=t,format=yuv420p[vout]')
    inputs += ['-i', wav]

    # grain costs bits: cap the rate so the file stays easy to send (~30 MB)
    run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', ';'.join(graph),
         '-map', '[vout]', '-map', f'{k}:a', '-t', str(LENGTH), '-r', str(FPS),
         '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-maxrate', '16M', '-bufsize', '32M',
         '-tune', 'grain', '-pix_fmt', 'yuv420p',
         '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', out])
    print(out)


if __name__ == '__main__':
    main()
