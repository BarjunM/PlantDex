# Google Maps API Setup Guide

This guide will help you set up a Google Maps API key for use in the PlantDex application.

## Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top of the page
3. Click "New Project"
4. Enter a name for your project and click "Create"

## Step 2: Enable the Maps JavaScript API

1. In your new project, go to "APIs & Services" > "Library"
2. Search for "Maps JavaScript API"
3. Click on "Maps JavaScript API" in the results
4. Click "Enable"

## Step 3: Create an API Key

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API Key"
3. Your new API key will be displayed

## Step 4: Restrict Your API Key (Recommended)

For security, it's recommended to restrict your API key:

1. In the API keys list, find your key and click "Edit"
2. Under "Application restrictions", choose "HTTP referrers (websites)"
3. Add your website domains (e.g., `localhost`, `*.yourdomain.com`)
4. Under "API restrictions", select "Restrict key"
5. Select "Maps JavaScript API" from the dropdown
6. Click "Save"

## Step 5: Add the API Key to Your Environment Variables

Add your API key to your `.env.local` file:

