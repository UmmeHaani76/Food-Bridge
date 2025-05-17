import express from 'express';
import fetch from 'node-fetch';
const router = express.Router();

const ORS_API_KEY = '5b3ce3597851110001cf6248809064b9d35a45d3935be8b7901cf79d';

router.post('/route', async (req, res) => {
    try {
        const { ngoLocation, donorLocation } = req.body;

        if (!ngoLocation || !donorLocation) {
            return res.status(400).json({ error: 'Missing location data' });
        }

        const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
            method: 'POST',
            headers: {
                'Authorization': ORS_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json, application/geo+json'
            },
            body: JSON.stringify({
                coordinates: [
                    [ngoLocation.lng, ngoLocation.lat],
                    [donorLocation.lng, donorLocation.lat]
                ],
                instructions: true,
                format: 'geojson'
            })
        });

        if (!response.ok) {
            throw new Error('Failed to get route from OpenRouteService');
        }

        const routeData = await response.json();
        res.json({ route: routeData.features[0] });

    } catch (error) {
        console.error('Route calculation error:', error);
        res.status(500).json({ error: 'Failed to calculate route' });
    }
});

export default router;