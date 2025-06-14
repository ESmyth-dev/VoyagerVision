# Contributing to VoyagerVision

Thanks for your interest in contributing! 🎉 Whether you’re fixing a typo, adding a feature, or restructuring code, your help is appreciated.

## How to Contribute

1. **Fork the repository** and clone your fork locally.
2. **Create a new branch** for your change:
   ```bash
   git checkout -b your-feature-name
   ```
3. **Make your changes**, and commit them with a clear message.
4. **Push your branch** and open a pull request.

## Project Structure

Here’s a quick overview of where key components live:

```
Voyager/
├── voyager/                      # Main application source code
│   ├── agent/                    # Logic for each of the agents present in the system
│   ├── env/                      # API routes and request handlers
|   |   ├── mineflayer/index.js   # Direct control of the camera which the agent uses to acquire visuals can be found here    
│   ├── prompts/                  # Prompts sent to each of the agents can be found here 
├── CONTRIBUTING.md               # You are here!
└── README.md                     # Project overview
```
