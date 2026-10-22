#!/usr/bin/env python3
"""Build the three token-status CSVs from artifacts/retest/retest-results-v2.json.

Usage: python3 scripts/build-retest-csvs.py --allure-dir <extracted allure-report dir> --foundation-root <foundation-css src dir> [--out ~/Downloads]

Status values are only PASS, FAIL, NOT MAPPED (see the verify-rn-style-mapping skill):
  PASS        preview value equals the applied token
  FAIL        the token's CSS var is bound in a __trace but the value is wrong or missing
  NOT MAPPED  no trace binds the token's CSS var on the instance
Outputs: 1-new-tokens-status.csv (all new tokens), 2-verified-failed-tokens.csv (all FAIL rows),
         3-existing-tokens-need-mapping.csv (existing tokens that are NOT MAPPED).
NOT MAPPED rows also get foundation_css_* columns (token JSON CSS variable, .less rule, derived RN path).
datetime is not in the results (picker flow cannot be read in the preview).
"""
import argparse, collections, csv, glob, json, os, re

ap = argparse.ArgumentParser()
ap.add_argument('--allure-dir', required=True)
ap.add_argument('--foundation-root', required=True, help='foundation-css src dir (contains tokens/ and styles/)')
ap.add_argument('--old-slots', default='reports/widget-token-slots.backup-20261015.json', help='slots before the Oct 2026 scrape, to tell new tokens apart')
ap.add_argument('--out', default=os.path.expanduser('~/Downloads'))
a = ap.parse_args()
camel = lambda s: re.sub(r'-([a-z0-9])', lambda m: m.group(1).upper(), s)

UNREADABLE = {'modal-dialog'}  # styles exist only while the dialog is open: every preview read is empty, and Jenkins could not open it either
R = [r for r in json.load(open('artifacts/retest/retest-results-v2.json'))['results'] if r['widget'] not in UNREADABLE]
tm = json.load(open('Tokens/token-values-mobile.json'))

def load(f):
    d = json.load(open(f))
    return {w: {p: t['tokenType'] for t in v['tokenSlots'] for p in t['properties']} for w, v in d.items() if isinstance(v, dict)}
old, new = load(a.old_slots), load('wdio/config/widget-token-slots.json')

A = {}
for f in glob.glob(os.path.join(a.allure_dir, 'data/test-cases/*.json')):
    d = json.load(open(f))
    m = re.match(r'(?:Android|iOS): validate \{(.+?)\} @ (\S+) \[(.+?)\]$', d['name'])
    if m: A[(m.group(2), m.group(1), m.group(3))] = (d['status'], (d.get('statusMessage') or '').split('\n')[0])

def jenkins(r):
    if r['source'] != 'oct19': return 'not run'
    for pf in (r['property'], f"states.{r['state']}.{r['property']}"):
        x = A.get((r['instance'], r['token'], pf))
        if x: return 'PASS' if x[0] == 'passed' else ('not run' if re.search('not displayed|Timeout|nav', x[1]) else 'FAIL')
    return 'not run'

# foundation: .less bindings and token-json CSS variables
B = collections.defaultdict(list)
for f in glob.glob(os.path.join(a.foundation_root, 'styles/mobile/components/**/*.less'), recursive=True):
    stack = []
    for raw in open(f, errors='ignore'):
        line = raw.split('//')[0].strip()
        if not line: continue
        m = re.match(r'^([^{};:]*[.#&][^{};]*)\{\s*$', line)
        if m:
            sel = m.group(1).strip().split(',')[0].strip(); parent = stack[-1] if stack else ''
            stack.append(sel.replace('&', parent) if '&' in sel else (parent + ' ' + sel if parent else sel)); continue
        if line.startswith('}'):
            if stack: stack.pop()
            continue
        m = re.match(r'^([a-z-]+)\s*:\s*(.*?);?$', line)
        if m and stack:
            for v in re.findall(r'var\((--wm-[a-z0-9-]+)', m.group(2)):
                cl = re.findall(r'\.[A-Za-z0-9_-]+', stack[-1]); B[v].append((m.group(1), cl[-1][1:] if cl else '', os.path.basename(f)[:-5]))

def tokvars(widget, prop):
    d = {'formcontrols': 'form-controls'}.get(widget, widget)
    p = os.path.join(a.foundation_root, f'tokens/mobile/components/{d}/{d}.json')
    if not os.path.exists(p): return None, False
    j = json.load(open(p)); out = set(); want = prop.split('.'); exists = [False]
    def walk(o, path=()):
        if isinstance(o, dict):
            if 'value' in o and isinstance(o.get('attributes'), dict):
                tail = list(path[path.index('mapping') + 1:]) if 'mapping' in path else None
                if tail and tail[0] == 'states' and len(tail) > 2: tail = tail[2:]
                if (tail == want) if tail is not None else (list(path[-len(want):]) == want):
                    exists[0] = True
                    m = re.search(r'CSS variable:\s*(--wm-[a-z0-9-]+)', o['attributes'].get('description', ''))
                    if m: out.add(m.group(1))
                return
            for k, v in o.items(): walk(v, path + (k,))
    walk(j); return sorted(out), exists[0]

styles = {}
def live(w, pth):
    if w not in styles:
        f = f'artifacts/rn-styles/{w}.styles.json'; styles[w] = json.load(open(f)) if os.path.exists(f) else None
    s = styles[w]
    if s is None: return 'no snapshot'
    for seg in pth.split('.'):
        if not isinstance(s, dict) or seg not in s: return 'missing'
        s = s[seg]
    return 'present'

LONGHAND = {'borderRadius': ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'],
            'borderWidth': ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'],
            'padding': ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
            'margin': ['marginTop', 'marginRight', 'marginBottom', 'marginLeft']}
def path_equal(mapped, cand):
    if mapped == cand: return True
    mn, _, mp = mapped.rpartition('.'); cn, _, cp = cand.rpartition('.')
    return mn == cn and mp in LONGHAND.get(cp, [])

def foundation(widget, prop, mapped):
    vs, exists = tokvars(widget, prop)
    if vs is None: return '', '', 'no token file for this widget in foundation'
    if not vs:
        return '', '', ('token exists in foundation but its description names no CSS variable, so the .less binding cannot be looked up' if exists else 'slot not found in the foundation token file')
    rules = [(v,) + b for v in vs for b in B.get(v, [])]
    if not rules: return '; '.join(vs), '', 'no foundation .less rule uses ' + ' / '.join(vs)
    base = 'app-' + rules[0][3]; desc = []; cands = []
    for v, cp, last, file in rules[:3]:
        ns = 'root' if last == base or not last else camel(last[len(base) + 1:]) if last.startswith(base + '-') else camel(last.replace('app-', ''))
        cand = f'{ns}.{camel(cp)}'; cands.append(cand); desc.append(f'.{last} {{ {cp}: var({v}) }} -> {cand} [live styles: {live(widget, cand)}]')
    same = any(path_equal(mapped, c) for c in cands)
    chk = 'foundation binds it; ' + ('mapper path matches the CSS path' if same else 'mapper path differs from the CSS path')
    return '; '.join(vs), ' | '.join(desc), chk

H = ['widget', 'instance', 'state', 'property', 'token_type', 'token', 'expected', 'actual', 'status', 'reason', 'mapped_path', 'bound_css_var', 'jenkins_oct19', 'new_or_existing', 'trace_bound_at', 'foundation_css_var', 'foundation_css_rule', 'foundation_check']
rows = []
for r in R:
    isnew = r['property'] in new.get(r['widget'], {}) and r['property'] not in old.get(r['widget'], {})
    reason = ''; fv = fr = fc = ''; bound_at = ''; bound_var = ''
    if r['status'] != 'PASS':
        # Only the variable the foundation token JSON declares for THIS slot counts as a binding. Suffix look-alikes belong to other
        # slots (for example --wm-form-controls-floating-font-size is not the slot font.size).
        fv, fr, fc = foundation(r['widget'], r['property'], r['mappedPath'])
        fvs = set(fv.split('; ')) if fv else set()
        binds = r.get('bindings') or []
        if fvs: binds = [x for x in binds if x['cssVar'] in fvs]
        at = [x for x in binds if x['atMapped']]; els = [x for x in binds if not x['atMapped']]
        read = r['output'] or 'nothing'
        if at:
            r = dict(r, status='FAIL'); bound_var = '; '.join(sorted({x['cssVar'] for x in at}))
            reason = f"token is bound at the mapped property ({bound_var}) but the value read is {read}, expected {r['expected']}"
        else:
            r = dict(r, status='NOT MAPPED'); bound_at = '; '.join(dict.fromkeys(x['path'] for x in els))
            reason = (f"the token's variable is bound at {bound_at}, not at the mapped path {r['mappedPath']} (value read: {read})" if els
                      else f"no trace binds this token's variable on the instance (value read: {read})")
            if 'mapper path matches the CSS path' in fc and not els:
                r = dict(r, status='FAIL')
                reason = f"mapped per foundation CSS ({r['mappedPath']}) but the value read is {read}, expected {r['expected']}: token not working"
    rows.append(dict(widget=r['widget'], instance=r['instance'], state=r['state'], property=r['property'],
                     token_type=new.get(r['widget'], {}).get(r['property'], ''), token=r['token'],
                     expected=tm.get('{' + r['token'] + '}', r['expected']), actual=r['output'] or '(empty)', status=r['status'], reason=reason,
                     mapped_path=r['mappedPath'], bound_css_var=bound_var, jenkins_oct19=(jenkins(r) if jenkins(r) != 'not run' else f"{r['status']} (preview only)"),
                     new_or_existing='NEW' if isnew else 'existing', trace_bound_at=bound_at, foundation_css_var=fv, foundation_css_rule=fr, foundation_check=fc))
rows.sort(key=lambda x: (x['widget'], x['property'], x['instance']))
print('relabelled NOT MAPPED -> FAIL (mapper already follows foundation CSS):', sum(1 for x in rows if x['status'] == 'FAIL' and x['foundation_check'].startswith('foundation binds it; mapper path matches')))
sel = {'1-new-tokens-status.csv': [x for x in rows if x['new_or_existing'] == 'NEW'],
       '2-verified-failed-tokens.csv': [x for x in rows if x['status'] == 'FAIL'],
       '3-existing-tokens-need-mapping.csv': [x for x in rows if x['status'] == 'NOT MAPPED' and x['new_or_existing'] == 'existing']}
for f, rs in sel.items():
    with open(os.path.join(a.out, f), 'w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=H); w.writeheader(); w.writerows(rs)
    print(f, len(rs), dict(collections.Counter(x['status'] for x in rs)))
print('all rows', len(rows), dict(collections.Counter(x['status'] for x in rows)))
