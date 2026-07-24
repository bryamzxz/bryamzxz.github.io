---
layout: page
title: About & disclosure policy
kicker: Contact · Methodology · Coordinated disclosure
subtitle: How this research is conducted, how to reach me, and what to expect if you report something or are reported on.
permalink: /about/
description: "Bryam Vargas — independent security researcher in Bogotá, Colombia. Coordinated disclosure practice, research methodology, and contact details including PGP and Signal."
---

## Who

I am **Bryam Vargas**, an independent security researcher based in Bogotá,
Colombia. I work unaffiliated: no employer, no vendor, no sponsor has editorial
control over what is published here.

Three lines of work account for most of what appears on this site:

- **Coordinated disclosure in open-source software** — source-level review of
  widely deployed applications, with findings taken through the CVE process.
- **Bug bounty against Colombian state infrastructure** — public-sector systems
  reported through official channels.
- **Mobile-spyware forensics with civic partners** — device analysis for
  journalists and civil-society organisations.

## How the research is done

Every finding published here is produced source-first and reproduced before it
is written up. In practice that means:

1. **Read the code.** Findings start from reading the source and tracing data
   flow from an input source to a sink — not from scanner output.
2. **Reproduce in an isolated lab.** Containers or VMs, never a production
   system, never a third-party host. Lab parameters (versions, commits, build
   numbers) are published alongside each finding.
3. **Keep an audit trail.** Per-finding search output, taintability notes, and
   reproduction logs are retained and available on request.

### On AI assistance

This is stated deliberately, because it is increasingly load-bearing. In an era
where models can produce voluminous vulnerability reports of varying quality,
distinguishing rigorous work from automated output requires saying plainly
which is which.

- **Vulnerability identification is human-driven.** No model finds the call
  sites, classifies their reachability, or determines exploitability.
- **AI assistance is limited to documentation drafting** — wording, formatting,
  organising timelines — and is disclosed in the write-up whenever used.

## Disclosure policy

### If I report something to you

- **First contact** goes to the vendor or maintainer through their published
  security channel, with file and line references, a reproduction, and lab
  parameters.
- **90 days** is the default window between first contact and public
  disclosure. I will extend it for a maintainer who is engaging in good faith
  and needs more time, and I will say so publicly when I do.
- **One issue per advisory**, if that is what the maintainer prefers. Ask.
- **No exploit weaponisation.** Published proofs demonstrate that a sink is
  reachable. They are not drop-in attack tooling.
- **Credit** is welcome but not a condition of anything.
- If a maintainer declines to engage technically, the report is escalated
  through the CVE chain — GitHub Security Advisory Database, then MITRE
  Primary. Findings are published on schedule either way, with the record of
  the exchange reproduced as it occurred.

### If you want to report something to me

Reports about this site itself, or anything else you think I should look at,
are welcome at the address below. If you need to send something sensitive, ask
for the PGP key or a Signal number first and send nothing until you have it.

## Contact

| Channel | Detail |
|---|---|
| Email | [{{ site.email }}](mailto:{{ site.email }}) |
| PGP | Key on request — ask before sending anything sensitive |
| Signal | Available on request |
| Code | [github.com/bryamzxz](https://github.com/bryamzxz) |
| Feed | [Atom]({{ '/feed.xml' | relative_url }}) |

## About this site

Built with [Jekyll](https://jekyllrb.com), hosted on GitHub Pages, no
analytics, no trackers, no third-party scripts. The only external request the
site makes is to Google Fonts for the three typefaces it is set in. Source is
[on GitHub](https://github.com/bryamzxz/bryamzxz.github.io).

Everything here is published independently. Where a disclosure describes an
exchange with a vendor, the vendor's own words are reproduced verbatim so the
record stands on its own.
