source "https://rubygems.org"

# GitHub Pages builds this site with Jekyll 3.10 in safe mode. Pinning the same
# major here keeps `bundle exec jekyll serve` faithful to production without
# pulling the full `github-pages` gem, whose native extensions (nokogiri,
# commonmarker, eventmachine) are painful to build on current Ruby.
#
# For byte-exact parity instead, swap the three blocks below for:
#   gem "github-pages", group: :jekyll_plugins
gem "jekyll", "~> 3.10"

# Must match the `plugins:` list in _config.yml — GitHub Pages only runs
# plugins from its own allowlist, and all three of these are on it.
group :jekyll_plugins do
  gem "jekyll-feed", "~> 0.17"
  gem "jekyll-seo-tag", "~> 2.8"
  gem "jekyll-sitemap", "~> 1.4"
end

# GitHub Pages forces `kramdown.input: GFM`; _config.yml mirrors that, so the
# parser has to be present locally too.
gem "kramdown-parser-gfm", "~> 1.1"

group :test do
  gem "html-proofer", "~> 5.0"
end

# Gems that left the Ruby stdlib and are no longer auto-available under Bundler.
# webrick backs `jekyll serve` (dropped in Ruby 3.0); the rest became bundled
# gems in Ruby 3.4/3.5 and must be declared explicitly.
gem "webrick", "~> 1.9"
gem "erb", "~> 5.0"
gem "bigdecimal", "~> 3.1"
gem "base64", "~> 0.2"
gem "csv", "~> 3.3"
gem "logger", "~> 1.6"
gem "ostruct", "~> 0.6"
