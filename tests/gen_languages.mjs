/* Prints the language table of dashboard/plugin_api.py (`_LANGUAGE_TABLE`): one line per language,
 * `English name|alias|alias…`, aliases lower-cased: the language tag, the English name and the name in the
 * language itself. The names come from this Node's ICU data (Intl.DisplayNames), not from a hand-kept list.
 *
 * Run `node gen_languages.mjs` in tests/ and paste the output between the triple quotes of `_LANGUAGE_TABLE`
 * when a language is missing. The backend lets only a name from this table into the reviewer's prompt. */
const english = new Intl.DisplayNames(['en'], { type: 'language' })
const letters = 'abcdefghijklmnopqrstuvwxyz'
const tags = []
for (const a of letters) for (const b of letters) tags.push(a + b)
tags.push('zh-Hans', 'zh-Hant', 'zh-CN', 'zh-TW', 'pt-BR', 'pt-PT', 'es-419', 'en-US', 'en-GB', 'fr-CA', 'fil', 'yue')
const fold = s => s.normalize('NFC').toLowerCase()
const plain = s => /^[\p{L}\p{M}\p{N} ().'’-]+$/u.test(s) && !s.includes('|')
const seen = new Set()
const rows = new Map()
for (const tag of tags) {
  let name
  try {
    name = english.of(tag)
  } catch {
    continue
  }
  if (!name || fold(name) === fold(tag) || !plain(name)) continue
  const aliases = [fold(tag), fold(name)]
  if (Intl.DisplayNames.supportedLocalesOf([tag]).length) {
    const own = new Intl.DisplayNames([tag], { type: 'language' }).of(tag)
    if (own && plain(own) && fold(own) !== fold(tag)) aliases.push(fold(own))
  }
  const fresh = aliases.filter(a => !seen.has(a))
  for (const a of fresh) seen.add(a)
  if (!fresh.length) continue
  rows.set(name, [...(rows.get(name) || []), ...fresh])
}
for (const [name, aliases] of rows) console.log([name, ...new Set(aliases)].join('|'))
