import { defineConfig } from "rollup";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import esbuild from "rollup-plugin-esbuild";
import limbo from "rollup-plugin-limbo";

const isProd = process.env.MODE === "production";

export default defineConfig({
	input: "./src/plugin.ts",
	output: {
		dir: "build",
	},
	// these modules are not bundled and will be provided by the limbo app
	external: ["limbo"],
	plugins: [
		nodeResolve(),
		esbuild({
			minify: isProd,
		}),
		limbo({
			copyToPluginsDir: true,
			/*
				if you only want to copy the built plugin to the plugins directory during dev mode
				copyToPluginsDir: !isProd,
			*/
		}),
	],
});
