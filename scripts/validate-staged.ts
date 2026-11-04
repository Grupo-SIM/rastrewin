const staged = Bun.spawnSync(["git", "diff", "--cached", "--name-only"]).stdout.toString().split("\n");
const manifests = ["backend/package.json", "frontend/package.json", "track/package.json", "vsl/package.json"];
const packages = manifests.flatMap(path => {
	const result = Bun.spawnSync(["git", "show", `:${path}`]);
	if (result.exitCode) return [];
	const manifest = JSON.parse(result.stdout.toString());
	return [
		{
			dependencies: { ...manifest.dependencies, ...manifest.devDependencies },
			name: manifest.name as string,
			root: path.slice(0, -12),
		},
	];
});
const sharedChange = staged.some(path =>
	["package.json", "bun.lock", "turbo.jsonc", "scripts/validate-staged.ts"].includes(path),
);
const affected = new Set(
	packages
		.filter(pkg => sharedChange || staged.some(path => path.startsWith(pkg.root)))
		.map(pkg => pkg.name),
);
let changed = true;
while (changed) {
	changed = false;
	for (const pkg of packages)
		if (!affected.has(pkg.name) && Object.keys(pkg.dependencies).some(name => affected.has(name))) {
			affected.add(pkg.name);
			changed = true;
		}
}
if (affected.size) {
	const result = Bun.spawnSync(
		[
			"bun",
			"x",
			"--no-install",
			"turbo",
			"run",
			"check-types",
			...[...affected].flatMap(name => ["--filter", name]),
		],
		{ stderr: "inherit", stdout: "inherit" },
	);
	process.exit(result.exitCode);
}
