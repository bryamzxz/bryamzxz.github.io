#!/usr/bin/env ruby
# frozen_string_literal: true

# HTML validity, internal links, images and script references across the
# built site.
#
# External links stay off: this post cites ~15 third-party hosts (php.net,
# cve.org, bishopfox.com, …) and letting rate limits or someone else's
# downtime fail our CI would make the signal worthless. Link rot in the
# references is a real concern, but it belongs in a scheduled job, not in
# the gate on every pull request.

require "html-proofer"

HTMLProofer.check_directory(
  File.expand_path("../_site", __dir__),
  disable_external: true,
  checks: %w[Links Images Scripts],
  enforce_https: false,
  ignore_empty_alt: false
).run
