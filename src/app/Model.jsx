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
        clearcoat,
        clearcoatRoughness,
        transmission,
        thickness,
        attenuationDistance,
        attenuationColor,
        ior,
        reflectivity,
        sheen,
        sheenRoughness,
        sheenColor,
        specularIntensity,
        specularColor,
        iridescence,
        iridescenceIOR,
        iridescenceThicknessRange,
    } = params;
    return new CustomShaderMaterial({
        baseMaterial: THREE.MeshPhysicalMaterial,
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
        clearcoat,
        clearcoatRoughness,
        transmission,
        thickness,
        attenuationDistance,
        attenuationColor: new THREE.Color(attenuationColor),
        ior,
        reflectivity,
        sheen,
        sheenRoughness,
        sheenColor: new THREE.Color(sheenColor),
        specularIntensity,
        specularColor: new THREE.Color(specularColor),
        iridescence,
        iridescenceIOR,
        iridescenceThicknessRange,
        transparent: true,
        side: THREE.FrontSide,
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
        clearcoat: { value: 0.83, min: 0, max: 1, step: 0.01, label: "Clearcoat" },
        clearcoatRoughness: { value: 1, min: 0, max: 1, step: 0.01, label: "Clearcoat Roughness" },
        transmission: { value: 1, min: 0, max: 1, step: 0.01, label: "Transmission" },
        thickness: { value: 0.5, min: 0, max: 1, step: 0.01, label: "Thickness" },
        attenuationDistance: { value: 0.9, min: 0, max: 1, step: 0.01, label: "Attenuation Distance" },
        attenuationColor: { value: "#ffffff", label: "Attenuation Color" },
        ior: { value: 1.5, min: 1, max: 2.33, step: 0.01, label: "IOR" },
        reflectivity: { value: 0.5, min: 0, max: 1, step: 0.01, label: "Reflectivity" },
        sheen: { value: 1.0, min: 0, max: 1, step: 0.01, label: "Sheen" },
        sheenRoughness: { value: 1.0, min: 0, max: 1, step: 0.01, label: "Sheen Roughness" },
        sheenColor: { value: "#ffffff", label: "Sheen Color" },
        specularIntensity: { value: 1, min: 0, max: 1, step: 0.01, label: "Specular Intensity" },
        specularColor: { value: "#ffffff", label: "Specular Color" },
        iridescence: { value: 1, min: 0, max: 1, step: 0.01, label: "Iridescence" },
        iridescenceIOR: { value: 2.3, min: 1, max: 2.33, step: 0.01, label: "Iridescence IOR" },
        iridescenceThicknessRange: { value: [100, 400], min: 0, max: 1000, step: 1, label: "Iridescence Thickness Range" },
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
            // Material properties (loop for color types)
            const colorProps = [
                ["attenuationColor", controls.attenuationColor],
                ["sheenColor", controls.sheenColor],
                ["specularColor", controls.specularColor],
            ];
            colorProps.forEach(([key, val]) => {
                if (material[key] && material[key].set) material[key].set(val);
            });
            // Scalar properties
            const scalarProps = [
                "roughness","metalness","clearcoat","clearcoatRoughness","transmission","thickness","attenuationDistance","ior","reflectivity","sheen","sheenRoughness","specularIntensity","iridescence","iridescenceIOR","iridescenceThicknessRange"
            ];
            scalarProps.forEach((key) => {
                if (material[key] !== undefined && controls[key] !== undefined) material[key] = controls[key];
            });
        }
    });

    // === 7. Render Model ===
    return (
        <group ref={ref} position={pos} onClick={() => { if (blendRate === 0 || blendRate === 1) setIndex((index + 1) % names.length) }}>
            <primitive scale={scale} object={fbx} />
        </group>
    )
}