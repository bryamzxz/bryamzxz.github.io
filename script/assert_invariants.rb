#!/usr/bin/env ruby
# frozen_string_literal: true

# Site-specific regression guards for things a build error would not catch:
# metadata that only shows up in someone else's link preview, and the heading
# ids that the table of contents and the in-prose § cross-references are
# built from at runtime.

require "nokogiri"

SITE = File.expand_path("../_site", __dir__)
SITE_URL = "https://bryamzxz.github.io"

@failures = []

def check(name)
  problem = yield
  if problem
    @failures << "#{name}: #{problem}"
    puts "  FAIL  #{name} — #{problem}"
  else
    puts "  ok    #{name}"
  end
end

def pages
  Dir.glob(File.join(SITE, "**", "*.html")).sort
end

puts "Asserting site invariants in #{SITE}"

check "every page carries an absolute og:image" do
  missing = pages.reject do |f|
    Nokogiri::HTML5(File.read(f)).at_css('meta[property="og:image"]')&.[]("content")&.start_with?("#{SITE_URL}/")
  end
  "#{missing.size} page(s) without one: #{missing.map { |f| f.sub(SITE, '') }.join(', ')}" unless missing.empty?
end

check "no empty twitter handles" do
  bad = pages.select do |f|
    Nokogiri::HTML5(File.read(f)).css('meta[name^="twitter:"]').any? { |m| m["content"].to_s.strip =~ /\A@?\z/ }
  end
  "emitted by: #{bad.map { |f| f.sub(SITE, '') }.join(', ')}" unless bad.empty?
end

check "robots.txt points at the sitemap" do
  robots = File.read(File.join(SITE, "robots.txt"))
  "sitemap line missing" unless robots.include?("Sitemap: #{SITE_URL}/sitemap.xml")
end

check "sitemap lists home, about and the disclosure" do
  locs = Nokogiri::XML(File.read(File.join(SITE, "sitemap.xml"))).css("loc").map(&:text)
  wanted = ["#{SITE_URL}/", "#{SITE_URL}/about/"]
  missing = wanted.reject { |u| locs.include?(u) }
  missing += ["a post"] unless locs.any? { |u| u =~ %r{/\d{4}/\d{2}/\d{2}/} }
  "missing #{missing.join(', ')}" unless missing.empty?
end

# The table of contents, the heading permalinks and the § cross-references are
# all built client-side from ids kramdown emits. If auto_ids ever gets turned
# off, the page still renders and nothing else would notice.
posts = Dir.glob(File.join(SITE, "[0-9]*", "**", "index.html"))

check "posts exist to validate" do
  "no post output found" if posts.empty?
end

posts.each do |path|
  slug = path.sub(SITE, "")
  doc = Nokogiri::HTML5(File.read(path))
  body = doc.at_css("[data-post-body]")

  check "#{slug} has a post body container" do
    "missing [data-post-body]" unless body
  end
  next unless body

  headings = body.css("h2, h3, h4")

  check "#{slug} every heading has an id" do
    without = headings.reject { |h| h["id"].to_s != "" }
    "#{without.size} heading(s) without an id, first: #{without.first&.text&.strip}" unless without.empty?
  end

  check "#{slug} ships the TOC container and site.js" do
    problems = []
    problems << "no [data-toc]" unless doc.at_css("[data-toc-body]")
    problems << "site.js not referenced" unless doc.at_css('script[src*="site.js"]')
    problems.join("; ") unless problems.empty?
  end

  # Build the number -> id map exactly the way site.js does, then confirm
  # every "§3.3" in the prose has somewhere to point.
  sections = {}
  headings.each do |h|
    next unless (m = h.text.strip.match(/\A(\d+(?:\.\d+)*)\.?\s+/))
    sections[m[1]] ||= h["id"]
  end

  prose = body.dup
  prose.css("code, pre, a, h1, h2, h3, h4, h5, h6").each(&:remove)
  refs = prose.text.scan(/§\s?(\d+(?:\.\d+)*)/).flatten.uniq

  check "#{slug} all #{refs.size} § cross-references resolve" do
    dangling = refs.reject { |r| sections.key?(r) }
    "no section for #{dangling.map { |r| "§#{r}" }.join(', ')}" unless dangling.empty?
  end
end

puts
if @failures.empty?
  puts "All invariants hold."
else
  puts "#{@failures.size} invariant(s) failed."
  exit 1
end
