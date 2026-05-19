/**
 * THREE.Clock was deprecated in three.js r168 in favour of THREE.Timer.
 * @react-three/fiber v8 instantiates Clock internally (in its render loop),
 * so the deprecation warning fires on every Canvas mount even though application
 * code never calls Clock directly. ES module namespace objects are sealed, so
 * we cannot replace THREE.Clock by assignment — instead we silence only this
 * specific console.warn message.
 *
 * Remove this file once @react-three/fiber migrates to THREE.Timer.
 * Must be imported before any R3F Canvas is rendered (i.e. before ReactDOM.render).
 */

const _warn = console.warn.bind(console)
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string') {
    // Suppress the Clock deprecation emitted by three.js r168+ when R3F v8 constructs it
    if (args[0].startsWith('THREE.Clock')) return
    // Suppress Mapbox GL terrain informational message (fires on every zoom into 3D terrain)
    if (args[0].includes('Cutoff is currently disabled on terrain')) return
  }
  _warn(...args)
}
