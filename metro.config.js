const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
const {wrapWithReanimatedMetroConfig} = require('react-native-reanimated/metro-config');
 
const config = getDefaultConfig(__dirname);

config.resolver = {
	...config.resolver,
	// react-native-webrtc (via event-target-shim) imports a legacy subpath.
	// Keep Metro on file-based resolution to avoid noisy export-map warnings.
	unstable_enablePackageExports: false,
};
 
module.exports = wrapWithReanimatedMetroConfig(withNativeWind(config, { input: './global.css' }));