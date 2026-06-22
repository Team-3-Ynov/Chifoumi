// Side-effect module: this must be imported BEFORE app.module.ts /
// auth.controller.ts so that the throttler picks up the production limits
// (forgot-password: 3/min) instead of the relaxed limits used when
// NODE_ENV === "test". ES module imports are evaluated in source order, so
// importing this file first guarantees the environment is set before the Nest
// module graph is evaluated. The suite restores NODE_ENV to "test" afterwards.
process.env.NODE_ENV = "production";
