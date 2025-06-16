import { useAnimations, useFBX, useTexture } from "@react-three/drei";
import * as THREE from 'three'
import { act, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useControls } from "leva";
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import CustomShaderMaterial from "three-custom-shader-material/vanilla";

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
        },
        fragmentShader: /* glsl */ `
            uniform vec3  uBaseColor;
            uniform vec3  uFresnelColor;
            uniform float uFresnelPow;
            uniform float uRatio;
            void main() {
                vec3 N = normalize(vNormal);
                vec3 V = normalize(vViewPosition);
                float fresnel = pow(1.0 - max(dot(N, V), 0.0), uFresnelPow);
                vec3 color = mix(uBaseColor, uFresnelColor, fresnel);
                float ratio = smoothstep(0.0, 0.02, uRatio) * smoothstep(1.0, 0.98, uRatio);
                csm_DiffuseColor = vec4(color, fresnel * ratio);
            }
        `,
        silent: true,
        roughness,
        metalness,
        wireframe,
        side: THREE.FrontSide,
        depthWrite: false,
        transparent: true,
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

export default function Model({ path, pos, scale = 1 }) {
    // === 1. Load FBX and Animations ===
    const fbx = useFBX(path)

    const { ref, actions, names } = useAnimations(fbx.animations);
    const index = 0

    const currentAction = useRef(null)

    // === 2. Gather all Leva controls in a single object ===
    const control = {
        baseColor: { value: "#ffffff", label: "Base Color" },
        fresnelColor: { value: "#ffffff", label: "Fresnel Color" },
        fresnelPower: { value: 2.0, min: 0.1, max: 5.0, step: 0.1, label: "Fresnel Power" },
        roughness: { value: 1, min: 0, max: 1, step: 0.01, label: "Roughness" },
        metalness: { value: 1, min: 0, max: 1, step: 0.01, label: "Metalness" },
        wireframe: { value: false, label: "Wireframe" },
    };
    const controls = useControls("Model Shader", control);

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
    useFrame(() => {
        if (!currentAction.current) return;
        const clip = currentAction.current.getClip ? currentAction.current.getClip() : currentAction.current._clip;
        const dur = clip.duration;
        const norm = (currentAction.current.time % dur) / dur;
        // Update shader uniforms and material properties
        if (material) {
            // Uniforms
            if (material.uniforms.uBaseColor) material.uniforms.uBaseColor.value.set(controls.baseColor);
            if (material.uniforms.uFresnelColor) material.uniforms.uFresnelColor.value.set(controls.fresnelColor);
            if (material.uniforms.uFresnelPow) material.uniforms.uFresnelPow.value = controls.fresnelPower;
            if (material.uniforms.uRatio) material.uniforms.uRatio.value = norm;
            // Material properties
            material.roughness = controls.roughness;
            material.metalness = controls.metalness;
        }
    });

    // === 7. Render Model ===
    return (
        <group ref={ref} position={pos}>
            <primitive scale={scale} object={fbx} />
        </group>
    )
}