import { CameraControls } from "@react-three/drei";
import { Canvas } from '@react-three/fiber'
import Head from '../component/Head.jsx'
import AccumulatedBloomTrailEffect from "../component/AccumulatedBloomTrailEffect";
import { Suspense, useEffect, useState } from "react";
import Model from "../component/Model.jsx";
import { Environment } from "@react-three/drei";
import { Leva } from 'leva';
import { customTheme } from "../r3f-gist/theme/levaTheme.js";
import Lighting from "../component/Lighting.jsx";

export default function App() { 
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        const handleKeyPress = (event) => {
            if (event.code === 'Space') {
                setIsPaused(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, []);

    return <>
        <Leva theme={customTheme} hidden={false} />  

        <Canvas
            shadows
            camera={{
                fov: 30,
                near: 0.1,
                far: 200,
                position: [0, 1, 5]
            }}
        >
            <color attach="background" args={['#000000']} />
            <CameraControls makeDefault />
            <Lighting helper={false} />

            <Suspense fallback={null}>
                <Model 
                    path="ballerina_dance_smooth.fbx" 
                    scale={0.01} 
                    pos={[0, -1, 0]} 
                    initRot={[0, Math.PI * -0.25, 0]}
                    isPaused={isPaused}
                />
            </Suspense>
            <AccumulatedBloomTrailEffect isPaused={isPaused} />
            {/* <Utilities /> */}
        </Canvas>
    </>
}