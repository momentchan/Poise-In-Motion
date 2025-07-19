import { useAnimations, useFBX, useTexture } from "@react-three/drei";
import * as THREE from 'three'
import { act, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useControls } from "leva";
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import CustomShaderMaterial from "three-custom-shader-material/vanilla";
import { useCustomFBX } from "./useCustomFBX";
import photoshopMath from "../r3f-gist/shader/cginc/photoshopMath.glsl?raw";

// === Helper: Create Custom Material ===
function createCustomMaterial(params) {
    const {
        baseColor,
        fresnelColor,
        fresnelPower,
        roughness,
        metalness,
        wireframe,
    } = params;
    return new CustomShaderMaterial({
        baseMaterial: THREE.MeshStandardMaterial,
        uniforms: {
            uBaseColor: { value: new THREE.Color(baseColor) },
            uFresnelColor: { value: new THREE.Color(fresnelColor) },
            uFresnelPow: { value: fresnelPower },
            uRatio: { value: 0 },
            uTime: { value: 0 },
            uHsvRange: { value: new THREE.Vector3(0, 1, 1) }, // min HSV
            uHsvRangeMax: { value: new THREE.Vector3(1, 1, 1) }, // max HSV
            uColorCycleSpeed: { value: 0.5 },
            uUseHsvMode: { value: false },
        },
        fragmentShader: /* glsl */ `
            ${photoshopMath}
            
            uniform vec3  uBaseColor;
            uniform vec3  uFresnelColor;
            uniform float uFresnelPow;
            uniform float uRatio;
            uniform float uTime;
            uniform vec3  uHsvRange;
            uniform vec3  uHsvRangeMax;
            uniform float uColorCycleSpeed;
            uniform bool  uUseHsvMode;
            
            vec3 cycleColorInRange(vec3 baseColor, vec3 minHsv, vec3 maxHsv, float time) {
                vec3 hsv = rgb2hsv(baseColor);
                
                // Calculate the range for each component
                vec3 range = maxHsv - minHsv;
                
                // Create a cycling value between 0 and 1
                float cycle = fract(time * uColorCycleSpeed);
                
                // Interpolate within the HSV range
                vec3 newHsv = minHsv + range * cycle;
                
                // Ensure hue wraps properly (0-1 range)
                newHsv.x = fract(newHsv.x);
                
                // Clamp saturation and value to valid ranges
                newHsv.y = clamp(newHsv.y, 0.0, 1.0);
                newHsv.z = clamp(newHsv.z, 0.0, 1.0);
                
                return hsv2rgb(newHsv);
            }
            
            void main() {
                vec3 N = normalize(vNormal);
                vec3 V = normalize(vViewPosition);
                float fresnel = pow(1.0 - max(dot(N, V), 0.0), uFresnelPow);
                vec3 color = mix(uBaseColor, uFresnelColor, fresnel);
                
                // Cycle color within the specified HSV range only if HSV mode is enabled
                if (uUseHsvMode) {
                    color = cycleColorInRange(color, uHsvRange, uHsvRangeMax, uTime);
                }
                
                float ratio = smoothstep(0.0, 0.02, uRatio) * smoothstep(1.0, 0.98, uRatio);
                color += ambientLightColor;
                csm_DiffuseColor = vec4(color, fresnel * ratio);
            }
        `,
        silent: true,
        roughness,
        metalness,
        wireframe,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
}

// === Helper: Add Depth Copy to FBX Meshes ===
function addDepthCopyToFBX(fbx, material) {
    const depthMat = new THREE.MeshBasicMaterial({
        colorWrite: false,
        depthWrite: true,
        side: THREE.FrontSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
    });
    const DEPTH_TAG = '__depthCopy';
    fbx.traverse((child) => {
        if (!child.isMesh) return;
        child.material = material;
        child.renderOrder = 1;
        child.frustumCulled = false;
        if (!child.userData[DEPTH_TAG]) {
            const copy = child.isSkinnedMesh
                ? (() => {
                    const sk = new THREE.SkinnedMesh(child.geometry, depthMat);
                    sk.bind(child.skeleton, child.bindMatrix);
                    return sk;
                })()
                : new THREE.Mesh(child.geometry, depthMat);
            copy.renderOrder = 0;
            copy.frustumCulled = false;
            child.parent.add(copy);
            child.userData[DEPTH_TAG] = copy;
        }
    });
}

export default function Model({ path, pos, scale = 1, initRot = [0, 0, 0], isPaused = false }) {
    // === 1. Load FBX and Animations ===
    const fbx = useCustomFBX(path)

    const [rot, setRot] = useState(initRot)

    const { ref, actions, names } = useAnimations(fbx.animations);
    const index = 0

    const currentAction = useRef(null)
    const randomRotation = useRef(Math.random() * Math.PI * 2) // Random angle between 0 and 2π
    const randomOffset = useRef({ x: 0, z: 0 }) // Random position offset on XZ plane

    // === 2. Gather all Leva controls in a single object ===
    const control = {
        baseColor: { value: "#ffffff", label: "Base Color" },
        fresnelColor: { value: "#ffffff", label: "Fresnel Color" },
        fresnelPower: { value: 2.0, min: 0.1, max: 5.0, step: 0.1, label: "Fresnel Power" },
        roughness: { value: 1, min: 0, max: 1, step: 0.01, label: "Roughness" },
        metalness: { value: 1, min: 0, max: 1, step: 0.01, label: "Metalness" },
        wireframe: { value: false, label: "Wireframe" },
        offsetRange: { value: 2, min: 0, max: 5, step: 0.1, label: "Position Offset Range" },
        useHsvMode: { value: false, label: "Enable HSV Mode" },
        colorCycleSpeed: { value: 0.001, min: 0, max: 0.01, step: 0.001, label: "Color Cycle Speed" },
        hsvRangeMin: { 
            value: { x: 0, y: 0.5, z: 1 }, 
            label: "HSV Range Min",
            step: 0.01,
            min: 0,
            max: 1
        },
        hsvRangeMax: { 
            value: { x: 1, y: 0.5, z: 1 }, 
            label: "HSV Range Max",
            step: 0.01,
            min: 0,
            max: 1
        },
    };
    const controls = useControls("Model Shader", control, { collapsed: true });

    // === 3. Material Setup ===
    const material = useMemo(() => createCustomMaterial(controls), [controls]);

    // === 4. Animation Setup ===
    useEffect(() => {
        const action = actions[names[index]];
        action.play();
        currentAction.current = action;
    }, [actions, names, index]);

    // === 5. Add Depth Copy to FBX Meshes ===
    useEffect(() => {
        if (!fbx) return;
        addDepthCopyToFBX(fbx, material);
    }, [fbx, material]);

    // === 6. Animation Frame Updates ===
    const lastNorm = useRef(0);
    useFrame((state) => {
        if (!currentAction.current) return;
        
        // Handle pause state
        if (isPaused) {
            currentAction.current.paused = true;
        } else {
            currentAction.current.paused = false;
        }
        
        const clip = currentAction.current.getClip ? currentAction.current.getClip() : currentAction.current._clip;
        const dur = clip.duration;
        const norm = (currentAction.current.time % dur) / dur;

        // Apply random rotation and position when animation finishes
        if (lastNorm.current > 0.95 && norm < 0.05 && ref.current) {
            setRot([0, Math.random() * Math.PI * 2, 0])
            randomOffset.current = {
                x: (Math.random() - 0.5) * controls.offsetRange * 2,
                y: -0.5,
                z: (Math.random() - 0.5) * controls.offsetRange * 2
            };
            // ref.current.position.set(randomOffset.current.x, randomOffset.current.y, randomOffset.current.z)
        }
        lastNorm.current = norm;
        // Update shader uniforms and material properties
        if (material) {
            // Uniforms
            if (material.uniforms.uBaseColor) material.uniforms.uBaseColor.value.set(controls.baseColor);
            if (material.uniforms.uFresnelColor) material.uniforms.uFresnelColor.value.set(controls.fresnelColor);
            if (material.uniforms.uFresnelPow) material.uniforms.uFresnelPow.value = controls.fresnelPower;
            if (material.uniforms.uRatio) material.uniforms.uRatio.value = norm;
            if (material.uniforms.uTime) material.uniforms.uTime.value += state.clock.elapsedTime;
            if (material.uniforms.uColorCycleSpeed) material.uniforms.uColorCycleSpeed.value = controls.colorCycleSpeed;
            if (material.uniforms.uUseHsvMode) material.uniforms.uUseHsvMode.value = controls.useHsvMode;
            if (material.uniforms.uHsvRange) material.uniforms.uHsvRange.value.set(controls.hsvRangeMin.x, controls.hsvRangeMin.y, controls.hsvRangeMin.z);
            if (material.uniforms.uHsvRangeMax) material.uniforms.uHsvRangeMax.value.set(controls.hsvRangeMax.x, controls.hsvRangeMax.y, controls.hsvRangeMax.z);
            // Material properties
            material.roughness = controls.roughness;
            material.metalness = controls.metalness;
            material.wireframe = controls.wireframe;
        }
    });

    // === 7. Render Model ===
    return (
        <group ref={ref} position={pos} rotation={rot}>
            <primitive scale={scale} object={fbx} />
        </group>
    )
}