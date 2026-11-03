"""
The Gemini website in Firefox, through Selenium (FR-SCR-7 fallback).

Ported from next-level/dashboard scrapers/gemini_scraper.py (profile login, input and send
selectors, waiting on the stop button, reading the last reply once it stops changing).
Selenium is imported only when the browser starts, so the tests never need it.
"""

import time

GEMINI_URL = 'https://gemini.google.com/app'

INPUT_SELECTORS = ['div[role="textbox"]', 'div[contenteditable="true"]', 'rich-textarea div']
SEND_SELECTORS = [
    'button[aria-label="Send message"]',
    'button[aria-label*="Send"]',
    'button.send-button',
]
STOP_SELECTORS = [
    'button[aria-label="Stop generating"]',
    'button[aria-label="Stop response"]',
    'button[aria-label*="Stop"]',
    '.stop-button',
]
RESPONSE_SELECTORS = [
    'model-response .markdown',
    'model-response',
    '.model-response-text',
    'div[data-message-author-role="model"]',
    '.response-content',
]


class BrowserStartError(Exception):
    """Firefox or geckodriver could not start (Firefox still open, bad path…)."""


class LoginNeeded(Exception):
    """Gemini shows a sign-in page instead of the chat."""


class Browser:
    def __init__(self):
        self.driver = None

    def start(self, profile, driver):
        try:
            from selenium import webdriver
            from selenium.webdriver.firefox.options import Options
            from selenium.webdriver.firefox.service import Service
        except ImportError as error:
            raise BrowserStartError(f'Selenium is not installed: {error}') from error
        options = Options()
        # The profile only on the command line: also setting options.profile conflicts.
        options.add_argument('-profile')
        options.add_argument(profile)
        try:
            # An explicit driver path: Selenium Manager never downloads into the user profile.
            self.driver = webdriver.Firefox(service=Service(executable_path=driver), options=options)
        except Exception as error:  # noqa: BLE001 - every start failure is reported the same way
            raise BrowserStartError(
                f'Firefox could not start ({error}). Close Firefox and check the paths.'
            ) from error
        time.sleep(3)
        self.driver.get(GEMINI_URL)
        if not self._wait_for_input(15):
            if 'accounts.google.com' in (self.driver.current_url or ''):
                raise LoginNeeded('Sign in to Google in this Firefox profile first.')
            raise BrowserStartError('Gemini did not load in Firefox.')
        time.sleep(2)

    def ask(self, prompt):
        from selenium.webdriver.common.keys import Keys

        box = self._input()
        if box is None:
            raise RuntimeError('Could not find Gemini input box.')
        box.click()
        time.sleep(0.3)
        # Enter would send early: new lines are typed as Shift+Enter.
        for index, line in enumerate(prompt.split('\n')):
            if index > 0:
                box.send_keys(Keys.SHIFT, Keys.ENTER)
            box.send_keys(line)
        time.sleep(0.5)
        if not self._click_send():
            box.send_keys(Keys.RETURN)
        self._wait_for_reply()
        time.sleep(1)
        return self._stable_reply()

    def close(self):
        if self.driver is not None:
            try:
                self.driver.quit()
            except Exception:  # noqa: BLE001 - closing never fails the run
                pass
            self.driver = None

    def _find(self, selectors):
        from selenium.webdriver.common.by import By

        for selector in selectors:
            try:
                for element in self.driver.find_elements(By.CSS_SELECTOR, selector):
                    if element.is_displayed():
                        return element
            except Exception:  # noqa: BLE001 - a selector that no longer exists is skipped
                continue
        return None

    def _wait_for_input(self, seconds):
        deadline = time.time() + seconds
        while time.time() < deadline:
            if self._find(INPUT_SELECTORS) is not None:
                return True
            time.sleep(0.5)
        return False

    def _input(self):
        return self._find(INPUT_SELECTORS) if self._wait_for_input(10) else None

    def _click_send(self):
        button = self._find(SEND_SELECTORS)
        if button is None:
            return False
        button.click()
        return True

    def _wait_for_reply(self, timeout=180):
        """Waits for the stop button to appear (15 s), then to go away (`timeout`)."""
        started = False
        for _ in range(30):
            if self._find(STOP_SELECTORS) is not None:
                started = True
                break
            time.sleep(0.5)
        if not started:
            time.sleep(5)
            return
        deadline = time.time() + timeout
        while time.time() < deadline and self._find(STOP_SELECTORS) is not None:
            time.sleep(0.5)

    def _last_reply(self):
        from selenium.webdriver.common.by import By

        for selector in RESPONSE_SELECTORS:
            try:
                elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    return elements[-1].text
            except Exception:  # noqa: BLE001
                continue
        return ''

    def _stable_reply(self, stable_for=2, max_wait=30):
        """The last reply once it hasn't changed for `stable_for` seconds (still streaming)."""
        last = self._last_reply()
        since = time.time()
        deadline = time.time() + max_wait
        while time.time() < deadline:
            time.sleep(0.5)
            current = self._last_reply()
            if current != last:
                last, since = current, time.time()
            elif time.time() - since >= stable_for:
                break
        return last
