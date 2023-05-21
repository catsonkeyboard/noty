/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    webpack(config) {
    config.experiments = { ...config.experiments, topLevelAwait: false }
    return config
  },
}

module.exports = nextConfig
