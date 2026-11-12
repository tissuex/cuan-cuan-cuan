import type { NextConfig } from "next";

const isMobileBuild = process.env.BUILD_TARGET === "mobile";

const turbopackConfig: NextConfig["turbopack"] = {
  rules: {
    "*.css": {
      loaders: ["@tailwindcss/turbopack"],
      as: "*.css",
    },
  },
};

const nextConfig: NextConfig = isMobileBuild
  ? {
      output: "export",
      images: {
        unoptimized: true,
      },
      trailingSlash: true,
      turbopack: turbopackConfig,
    }
  : {
      cacheComponents: true,
      partialPrefetching: true,
      // Pastikan hanya knowledge/playbook.md yang ikut ke bundle Vercel Functions,
      // sedangkan knowledge/source/ (arsip ebook PDF) selalu dikecualikan.
      outputFileTracingIncludes: {
        "/api/*": ["./knowledge/playbook.md"],
      },
      outputFileTracingExcludes: {
        "/*": ["./knowledge/source/**/*"],
      },
      turbopack: turbopackConfig,
    };

export default nextConfig;
