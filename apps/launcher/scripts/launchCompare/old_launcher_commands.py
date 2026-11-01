"""Asks NextLevelOS's runner (public/nextlevel-launcher.py) what it would run, without running it.

Usage: python -I old_launcher_commands.py <nextlevel-launcher.py> <jobs.json> <out.json>

jobs.json: [{"id": "...", "argv": ["-s", "Nintendo 64", "-r", "Game.zip", ...]}], the runner's
arguments without its own exe. out.json: one {"id", "exe", "args", "cwd", "env", "mounts",
"error"} per job.

The runner's own main() builds each command. Every process it would start is caught instead:
the final launch is recorded, squashfs/WSL mounts return a placeholder path and are listed in
"mounts", and anything else is an error. The runner reads data/config.json next to it; nothing
in NextLevelOS is written.
"""

import contextlib
import importlib.util
import io
import json
import os
import sys


class Captured(Exception):
    """The launch the runner's main() would start."""

    def __init__(self, cmd, cwd):
        super().__init__("captured")
        self.cmd = [str(part) for part in cmd]
        self.cwd = cwd


class Blocked(Exception):
    """A process the runner would start before the launch (never run)."""


class FakeSubprocess:
    PIPE = -1
    STDOUT = -2
    DEVNULL = -3

    class TimeoutExpired(Exception):
        pass

    class CalledProcessError(Exception):
        pass

    def run(self, cmd, *args, **kwargs):
        if sys._getframe(1).f_code.co_name == "main":
            raise Captured(cmd, kwargs.get("cwd"))
        raise Blocked(f"would run {cmd!r}")

    def Popen(self, cmd, *args, **kwargs):
        raise Blocked(f"would start {cmd!r}")

    call = check_call = check_output = Popen


def load_runner(path):
    os.chdir(os.path.dirname(os.path.abspath(path)))
    spec = importlib.util.spec_from_file_location("nextlevel_runner", path)
    module = importlib.util.module_from_spec(spec)
    with contextlib.redirect_stdout(io.StringIO()):
        spec.loader.exec_module(module)
    module.subprocess = FakeSubprocess()
    return module


def run_job(module, argv):
    mounts = []

    def fake_mount(image, internal="", *args, **kwargs):
        mounts.append({"image": str(image), "internal": str(internal or "")})
        return "<squashfs mount>\\" + str(internal or "")

    def fake_shortcut(shortcut_path, working_dir=None):
        raise Captured([shortcut_path], working_dir)

    module.get_squashfs_path = fake_mount
    module.get_squashfs_path_retrobat = fake_mount
    module.run_shortcut = fake_shortcut
    env_before = dict(os.environ)
    sys.argv = ["nextlevel-launcher", *argv]
    out = io.StringIO()
    result = {"exe": None, "args": [], "cwd": None, "env": {}, "mounts": mounts, "error": None}
    try:
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            module.main()
        result["error"] = "main() returned without launching"
    except Captured as captured:
        result["exe"] = captured.cmd[0]
        result["args"] = captured.cmd[1:]
        result["cwd"] = captured.cwd
    except SystemExit:
        # main()'s own "Error: ..." lines, or argparse's "...: error: ..." on stderr.
        errors = [line for line in out.getvalue().splitlines() if "rror:" in line]
        result["error"] = errors[-1] if errors else "exited"
    except Blocked as blocked:
        result["error"] = str(blocked)
    except Exception as error:  # the runner's own bug for this game: report it, keep going
        result["error"] = f"{type(error).__name__}: {error}"
    result["env"] = {
        key: value for key, value in os.environ.items() if env_before.get(key) != value
    }
    os.environ.clear()
    os.environ.update(env_before)
    return result


def main():
    runner, jobs_path, out_path = sys.argv[1:4]
    with open(jobs_path, encoding="utf-8") as f:
        jobs = json.load(f)
    module = load_runner(runner)
    results = [{"id": job["id"], **run_job(module, job["argv"])} for job in jobs]
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        json.dump(results, f, ensure_ascii=False)


if __name__ == "__main__":
    main()
