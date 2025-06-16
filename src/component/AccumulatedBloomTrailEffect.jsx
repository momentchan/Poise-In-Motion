/* PingPongEffectBloom.jsx  —  high-quality bloom with down-sample + N iterations */
import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { useFBO, useTexture } from '@react-three/drei'
import { useRef, useMemo, useEffect } from 'react'
import { folder, useControls } from 'leva'
import photoshopMath from '../r3f-gist/shader/cginc/photoshopMath.glsl?raw'

export default function AccumulatedBloomTrailEffect() {
  /* ==== UI sliders =========================================== */
  const controls = useControls('Accumulated Bloom Trail Effect', {
    Trail: folder({
      blendFactor: { value: 0.4, min: 0, max: 1, step: 0.01 },
      decay: { value: 0.9, min: 0, max: 0.995, step: 0.001 },
      delayFrames: { value: 10, min: 1, max: 100, step: 1 },
    }),
    Bloom: folder({
      bloomThreshold: { value: 0.1, min: 0, max: 1, step: 0.01 },
      bloomIntensity: { value: 0.6, min: 0, max: 3, step: 0.05 },
      bloomScatter: { value: 1.0, min: 0.3, max: 30, step: 0.1 },
      iterations: { value: 14, min: 1, max: 20, step: 1 },
      bloomScale: { value: 4, min: 1, max: 8, step: 1 },
      bloomBlend: { value: 0, min: 0, max: 1, step: 0.01 },
    }),
    Final: folder({
      finalColorOverlay: { value: '#ffffff' },
      paperBlend: { value: 0.5, min: 0, max: 1, step: 0.01 }
    })
  })

  /* ==== helpers ============================================== */
  const { gl, scene, camera, size } = useThree()

  /* full-res FBOs */
  const fboParams = useMemo(() => ({
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    stencilBuffer: false
  }), [])
  const fboSource = useFBO(size.width, size.height, fboParams)
  const trailA = useFBO(size.width, size.height, fboParams)
  const trailB = useFBO(size.width, size.height, fboParams)
  const displayRT = useFBO(size.width, size.height, fboParams)

  /* low-res bloom FBOs (created once, resized on window resize) */
  const low = useRef({ w: 1, h: 1 })
  const brightRT = useFBO(1, 1, fboParams)
  const blurA = useFBO(1, 1, fboParams)
  const blurB = useFBO(1, 1, fboParams)

  const rebuildLowRes = () => {
    const w = Math.max(1, Math.floor(size.width / controls.bloomScale))
    const h = Math.max(1, Math.floor(size.height / controls.bloomScale))

    low.current = { w, h }
    brightRT.setSize(w, h)
    blurA.setSize(w, h)
    blurB.setSize(w, h)
  }
  useEffect(rebuildLowRes, [size, controls.bloomScale])

  /* misc state */
  const usePing = useRef(true);    // ping-pong toggle for trail
  const frame = useRef(0)
  const paper = useTexture('/paper.png')

  /* ==== full-screen quad parts (trail / bright / blur / mix / final) ==== */
  const quadCam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])
  const quadGeo = useMemo(() => new THREE.PlaneGeometry(2, 2), [])

  /* === Shader Materials and Scenes === */
  const trailMat = useMemo(() => createTrailMaterial(controls), [controls])
  const trailScene = useMemo(() => new THREE.Scene().add(new THREE.Mesh(quadGeo, trailMat)), [quadGeo, trailMat])

  const brightMat = useMemo(() => createBrightMaterial(controls), [controls])
  const brightScene = useMemo(() => new THREE.Scene().add(new THREE.Mesh(quadGeo, brightMat)), [quadGeo, brightMat])

  const blurMat = useMemo(() => createBlurMaterial(), [])
  const blurScene = useMemo(() => new THREE.Scene().add(new THREE.Mesh(quadGeo, blurMat)), [quadGeo, blurMat])

  const mixMat = useMemo(() => createMixMaterial(controls), [controls])
  const mixScene = useMemo(() => new THREE.Scene().add(new THREE.Mesh(quadGeo, mixMat)), [quadGeo, mixMat])

  const finalMat = useMemo(() => createFinalMaterial(controls, paper), [controls, paper])
  const finalScene = useMemo(() => new THREE.Scene().add(new THREE.Mesh(quadGeo, finalMat)), [quadGeo, finalMat])

  /* ==== frame loop ============================================ */
  useFrame(() => {
    renderMainScene(gl, scene, camera, fboSource)
    updateTrail(gl, fboSource, trailA, trailB, trailMat, usePing, frame, controls, quadCam, trailScene)
    const trailTex = (usePing.current ? trailA : trailB).texture
    mixCurrentAndTrail(gl, fboSource, trailTex, mixMat, displayRT, mixScene, quadCam)
    runBrightPass(gl, displayRT, brightMat, brightScene, brightRT, quadCam)
    const bloomTex = runKawaseBlur(gl, brightRT, blurA, blurB, blurMat, blurScene, low, controls, quadCam)
    compositeToScreen(gl, finalMat, displayRT, bloomTex, paper, finalScene, quadCam, controls)
  }, 1)

  return null
}

/* === Helper Functions === */

function createTrailMaterial({ decay, blendFactor }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      current: { value: null },
      prev: { value: null },
      decay: { value: decay },
      blendFactor: { value: blendFactor }
    },
    vertexShader: /* glsl */ `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);}`,
    fragmentShader: /* glsl */ `uniform sampler2D current,prev;uniform float decay,blendFactor;
      varying vec2 vUv;void main(){vec3 c=texture2D(current,vUv).rgb;
      vec3 p=texture2D(prev,vUv).rgb*decay;gl_FragColor=vec4(clamp(c+p,0.,1.),1.);}`,
    depthTest: false, depthWrite: false
  })
}

function createBrightMaterial({ bloomThreshold }) {
  return new THREE.ShaderMaterial({
    uniforms: { src: { value: null }, thresh: { value: bloomThreshold } },
    vertexShader: /* glsl */ `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);}`,
    fragmentShader: /* glsl */ `uniform sampler2D src;uniform float thresh;varying vec2 vUv;
      void main(){vec3 c=texture2D(src,vUv).rgb;
      float l=max(max(c.r,c.g),c.b);gl_FragColor=vec4(l>thresh?c:vec3(0.),1.);}`,
    depthTest: false, depthWrite: false
  })
}

function createBlurMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { src: { value: null }, offset: { value: new THREE.Vector2() } },
    vertexShader: /* glsl */ `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);}`,
    fragmentShader: /* glsl */ `uniform sampler2D src;uniform vec2 offset;varying vec2 vUv;
      void main(){vec3 s=texture2D(src,vUv).rgb*0.294;
      s+=texture2D(src,vUv+offset).rgb*0.353;
      s+=texture2D(src,vUv-offset).rgb*0.353;gl_FragColor=vec4(s,1.);}`,
    depthTest: false, depthWrite: false
  })
}

function createMixMaterial({ blendFactor }) {
  return new THREE.ShaderMaterial({
    uniforms: { current: { value: null }, trail: { value: null }, blend: { value: blendFactor } },
    vertexShader: /* glsl */ `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);}`,
    fragmentShader: /* glsl */ `uniform sampler2D current,trail;uniform float blend;varying vec2 vUv;
      void main(){vec3 c=texture2D(current,vUv).rgb;
      vec3 t=texture2D(trail,vUv).rgb;gl_FragColor=vec4(clamp(c+t*blend,0.,1.),1.);}`,
    depthTest: false, depthWrite: false
  })
}

function createFinalMaterial({ bloomIntensity, finalColorOverlay, paperBlend, bloomBlend }, paper) {
  return new THREE.ShaderMaterial({
    uniforms: {
      base: { value: null },
      bloom: { value: null },
      intensity: { value: bloomIntensity },
      paper: { value: paper },
      finalColorOverlay: { value: new THREE.Color(finalColorOverlay) },
      paperBlend: { value: paperBlend },
      bloomBlend: { value: bloomBlend }
    },
    vertexShader: /* glsl */ `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);}`,
    fragmentShader: /* glsl */ `
      #include <common>
      ${photoshopMath}
      uniform sampler2D base,bloom,paper;
      uniform float intensity;
      uniform vec3 finalColorOverlay;
      uniform float paperBlend,bloomBlend;
      varying vec2 vUv;
      void main(){
        vec3 baseC = texture2D(base ,vUv).rgb;
        vec3 bloomC= texture2D(bloom,vUv).rgb*intensity;
        vec3 col = mix(baseC+bloomC, bloomC, bloomBlend);
        vec3 paperC= texture2D(paper,vUv).rgb;
        col = mix(col, BlendSoftLight(col,paperC), paperBlend);
        col *= finalColorOverlay;
        gl_FragColor = vec4(clamp(col,0.,1.),1.);
      }`,
    depthTest: false, depthWrite: false
  })
}

/* === Render Steps === */

function renderMainScene(gl, scene, camera, fboSource) {
  gl.setRenderTarget(fboSource)
  gl.clear()
  gl.render(scene, camera)
}

function updateTrail(gl, fboSource, trailA, trailB, trailMat, usePing, frame, controls, quadCam, trailScene) {
  frame.current++
  if (frame.current % controls.delayFrames === 0) {
    const prev = usePing.current ? trailA : trailB
    const next = usePing.current ? trailB : trailA
    trailMat.uniforms.current.value = fboSource.texture
    trailMat.uniforms.prev.value = prev.texture
    trailMat.uniforms.decay.value = controls.decay
    trailMat.uniforms.blendFactor.value = controls.blendFactor
    gl.setRenderTarget(next)
    gl.clear()
    gl.render(trailScene, quadCam)
    usePing.current = !usePing.current
  }
}

function mixCurrentAndTrail(gl, fboSource, trailTex, mixMat, displayRT, mixScene, quadCam) {
  mixMat.uniforms.current.value = fboSource.texture
  mixMat.uniforms.trail.value = trailTex
  mixMat.uniforms.blend.value = mixMat.uniforms.blend.value
  gl.setRenderTarget(displayRT)
  gl.clear()
  gl.render(mixScene, quadCam)
}

function runBrightPass(gl, displayRT, brightMat, brightScene, brightRT, quadCam) {
  brightMat.uniforms.src.value = displayRT.texture
  gl.setRenderTarget(brightRT)
  gl.clear()
  gl.render(brightScene, quadCam)
}

function runKawaseBlur(gl, brightRT, blurA, blurB, blurMat, blurScene, low, controls, quadCam) {
  let ping = blurA, pong = blurB
  for (let i = 0; i < controls.iterations; i++) {
    const horiz = (i & 1) === 0
    const off = horiz ? controls.bloomScatter / low.current.w : controls.bloomScatter / low.current.h
    blurMat.uniforms.src.value = (i === 0 ? brightRT.texture : ping.texture)
    blurMat.uniforms.offset.value.set(horiz ? off : 0.0, horiz ? 0.0 : off)
    gl.setRenderTarget(pong)
    gl.clear()
    gl.render(blurScene, quadCam)
    const tmp = ping; ping = pong; pong = tmp
  }
  return ping.texture
}

function compositeToScreen(gl, finalMat, displayRT, bloomTex, paper, finalScene, quadCam, controls) {
  finalMat.uniforms.base.value = displayRT.texture
  finalMat.uniforms.bloom.value = bloomTex
  finalMat.uniforms.intensity.value = controls.bloomIntensity
  finalMat.uniforms.paper.value = paper
  finalMat.uniforms.finalColorOverlay.value.set(controls.finalColorOverlay)
  finalMat.uniforms.paperBlend.value = controls.paperBlend
  finalMat.uniforms.bloomBlend.value = controls.bloomBlend
  gl.setRenderTarget(null)
  gl.clear()
  gl.render(finalScene, quadCam)
}
