const fs = require("fs-extra");
const path = require("path");
const nunjucks = require("nunjucks");
const { minify } = require("html-minifier-terser");

const srcDir = path.join(__dirname, "..", "src", "views");
const outDir = path.join(__dirname, "..", "docs");
const dataDir = path.join(__dirname, "..", "src", "data");

// Configure Nunjucks
nunjucks.configure([srcDir, path.join(srcDir, "en"), path.join(srcDir, "ru")], {
	autoescape: true,
	noCache: true,
});

// Ensure the output directory exists
fs.ensureDirSync(outDir);

// Get the current year
const currentYear = new Date().getFullYear();

// Language configuration
const languages = ["en", "ru"];

// Minification options
const minifyOptions = {
	collapseWhitespace: true,
	removeComments: true,
	removeOptionalTags: true,
	removeRedundantAttributes: true,
	removeScriptTypeAttributes: true,
	removeTagWhitespace: true,
	useShortDoctype: true,
	minifyCSS: true,
};

// Read site data
const siteData = JSON.parse(
	fs.readFileSync(path.join(dataDir, "site.json"), "utf8")
);

// Render the manifest
const manifestTemplatePath = path.join(srcDir, "manifest.njk");
const manifestOutputPath = path.join(outDir, "manifest.json");

// Base URL
const baseUrl = siteData.baseUrl;

// Compile and minify a template
async function compileAndMinifyTemplate(templatePath, outputPath, data) {
	try {
		const relativePath = path.relative(srcDir, templatePath);
		const renderedHtml = nunjucks.render(relativePath, {
			...data,
			currentPage: path.basename(templatePath, ".njk"),
		});
		const renderedManifest = nunjucks.render(manifestTemplatePath, {
			site: siteData,
		});
		const minifiedHtml = await minify(renderedHtml, minifyOptions);

		fs.ensureDirSync(path.dirname(outputPath));
		fs.writeFileSync(manifestOutputPath, renderedManifest);
		fs.writeFileSync(outputPath, minifiedHtml);

		console.log(`✨ Compiled and minified: ${outputPath}`);
	} catch (error) {
		console.error(`🤬 Error processing template ${templatePath}:`, error);
		throw error;
	}
}

// Build different versions based on the language
(async () => {
	for (const lang of languages) {
		const contentData = JSON.parse(
			fs.readFileSync(path.join(dataDir, `content-${lang}.json`), "utf8")
		);

		// Extract language-specific site data
		const langSiteData = siteData[lang];

		// Define pages to render
		const pages = [
			{ template: "index.njk", outputFile: "index.html", urlKey: "index" },
			{
				template: "readability-page.njk",
				outputFile: "readability.html",
				urlKey: "readabilityPage",
			},
		];

		// Loop through each page and render it
		for (const page of pages) {
			const currentPageUrl = `${baseUrl}${langSiteData.urls[page.urlKey]}`;

			// Get alternate language URL
			const alternateLang = lang === "en" ? "ru" : "en";
			const alternatePageUrl = `${baseUrl}${
				siteData[alternateLang].urls[page.urlKey]
			}`;

			const data = {
				content: contentData,
				site: langSiteData,
				pageUrl: currentPageUrl,
				alternateUrl: alternatePageUrl,
				currentYear: currentYear,
				languages: languages,
				currentLang: lang,
				baseUrl: baseUrl,
			};

			// Create language-specific output directory
			const langOutDir = path.join(outDir, lang);
			fs.ensureDirSync(langOutDir);

			// Compile templates for current language
			await compileAndMinifyTemplate(
				path.join(srcDir, lang, page.template),
				path.join(langOutDir, page.outputFile),
				data
			);
		}
	}
})().catch((error) => {
	console.error("🥵 Build failed:", error);
	process.exit(1);
});
