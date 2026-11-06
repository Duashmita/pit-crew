"""demo-tester: click the demo path headless, screenshot each beat, report pass/fail and console errors."""
import re, sys, time
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5174/"
OUT = sys.argv[2] if len(sys.argv) > 2 else "."
steps = []
errors = []

def step(name, fn):
    try:
        fn(); steps.append((name, True, "")); print(f"step  {name:<44} PASS", flush=True)
    except Exception as e:
        msg = str(e).split("\n")[0][:160]; steps.append((name, False, msg)); print(f"step  {name:<44} FAIL  {msg}", flush=True)

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1440, "height": 900})
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type in ("error",) else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    shot = lambda n: page.screenshot(path=f"{OUT}/{n}.png")

    def home():
        page.goto(URL, wait_until="networkidle"); page.wait_for_timeout(1500); shot("01-home")
        assert page.get_by_text(re.compile("shaking", re.I)).first.is_visible(), "home chip not visible"
    step("home renders with the chips", home)

    def checking():
        page.get_by_text(re.compile("shaking and the light", re.I)).first.click(); page.wait_for_timeout(2500); shot("02-checking")
        assert page.get_by_text(re.compile("read_dtcs|codes|P0301", re.I)).first.is_visible(), "no tool-call card"
    step("chip -> checking with tool-call cards", checking)

    def banner():
        page.get_by_text(re.compile(r"don.t drive", re.I)).first.wait_for(timeout=20000); page.wait_for_timeout(800); shot("03-banner")
        assert page.get_by_text(re.compile("mil_flashing_misfire", re.I)).first.is_visible(), "rule chip missing"
    step("banner: Don't drive + rule chip", banner)

    def send_alert():
        page.get_by_role("button", name=re.compile(r"just priya|^send$", re.I)).first.click()
        page.get_by_text(re.compile("on my way", re.I)).first.wait_for(timeout=8000); page.wait_for_timeout(800); shot("04-priya-alert")
    step("Send -> Priya's phone shows the alert", send_alert)

    def ack():
        page.get_by_role("button", name=re.compile("on my way", re.I)).first.click()
        page.get_by_text(re.compile("priya is on her way", re.I)).first.wait_for(timeout=8000); page.wait_for_timeout(500); shot("05-ack")
    step("On my way -> Maya sees the ack", ack)

    def diagnosis():
        page.get_by_role("button", name=re.compile("learn how", re.I)).first.click()
        page.get_by_text(re.compile("likely causes|cheapest test", re.I)).first.wait_for(timeout=8000); page.wait_for_timeout(800); shot("06-diagnosis")
        assert page.locator("#cyl-1.misfiring, #cyl-1 .misfiring, .misfiring").first.is_visible(), "no misfiring cylinder"
    step("Learn how to fix it -> diagnosis with pulsing cyl 1", diagnosis)

    def stepplayer():
        page.get_by_role("button", name=re.compile("show me", re.I)).first.click()
        page.get_by_text(re.compile("not to scale", re.I)).first.wait_for(timeout=8000); page.wait_for_timeout(600); shot("07-step")
        for box in page.get_by_role("checkbox").all():
            if not box.is_checked(): box.check()
        if not page.get_by_role("checkbox").count():
            for t in ("engine off", "engine cool"):
                page.get_by_text(re.compile(t, re.I)).first.click()
        page.wait_for_timeout(400)
        btn = page.get_by_role("button", name=re.compile("i did it", re.I)).first
        assert btn.is_enabled(), "I did it stays disabled after ticking"
        shot("08-step-ticked"); btn.click()
    step("Show me -> tick precautions -> I did it", stepplayer)

    def result():
        page.get_by_text(re.compile("followed the coil", re.I)).first.wait_for(timeout=25000); page.wait_for_timeout(1200); shot("09-result")
        assert page.get_by_text(re.compile(r"\$\s?\d", re.I)).first.is_visible(), "no price on result"
    step("Result: misfire followed the coil + fair price", result)

    def shops():
        page.get_by_role("button", name=re.compile("find a shop", re.I)).first.click()
        page.get_by_text(re.compile("Elm Street|Bayside|QuickFix", re.I)).first.wait_for(timeout=8000); page.wait_for_timeout(500)
        for name in ("Elm Street", "Bayside", "QuickFix"):
            page.get_by_text(re.compile(name, re.I)).first.click()
        page.wait_for_timeout(300); shot("10-shops")
        page.get_by_role("button", name=re.compile("draft", re.I)).first.click()
        page.get_by_text(re.compile("P0301")).first.wait_for(timeout=8000); page.wait_for_timeout(500); shot("11-draft")
        page.get_by_role("button", name=re.compile("approve", re.I)).first.click()
    step("Find a shop -> pick 3 -> draft -> approve", shops)

    def inbox():
        page.get_by_text(re.compile("above fair range", re.I)).first.wait_for(timeout=15000); page.wait_for_timeout(1500); shot("12-inbox")
        n = page.get_by_text(re.compile("in range|above fair range", re.I)).count()
        assert n >= 3, f"only {n} flag chips"
    step("Inbox: 3 replies, one flagged", inbox)

    b.close()

ok = sum(1 for s in steps if s[1])
print(f"steps {ok}/{len(steps)} PASS")
if errors:
    print("console/page errors:"); [print("  ", e[:200]) for e in errors[:12]]
sys.exit(0 if ok == len(steps) and not errors else 1)
