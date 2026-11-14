// Pins the test clock to midday of the current day, so a fixture stamped "a few minutes ago" stays on
// "Today" however late the suite runs. Without it a run just after midnight moved those records to
// "Yesterday" and the today-only checks (clock times, the day header) failed for reasons that had
// nothing to do with the code under test. Import it first: it must run before any fixture is built.
const RealDate = Date
const noon = new RealDate()
noon.setHours(12, 0, 0, 0)
const shift = noon.getTime() - RealDate.now()

class TestDate extends RealDate {
  constructor(...args) {
    if (args.length) super(...args)
    else super(RealDate.now() + shift)
  }

  static now() {
    return RealDate.now() + shift
  }
}

globalThis.Date = TestDate
