# Résumé des Spécifications : Application Décibel-mètre

Ce document résume les fonctionnalités et l'architecture de l'application décibel-mètre, basées sur les enregistrements audio fournis.

## 🎯 Objectif
Créer une application de mesure de décibels par équipe, avec une interface d'administration et un affichage public synchronisé, en suivant la pile technique du projet "no-match".

## 🛠️ Pile Technique (Identique à "no-match")
- **Framework UI** : React 19 + Vite
- **Native Wrapper** : Tauri 2 (Application de bureau)
- **Styling** : Tailwind CSS + shadcn/ui + Lucide React
- **Gestion d'État** : Zustand
- **Synchronisation** : LocalStorage / Polling (No-backend architecture)

## 📋 Fonctionnalités Principales

### 1. Page Publique (Affichage)
- **Visualisation des Jauges** : Affichage côte à côte des différentes équipes/jauges.
- **Composant Jauge** :
    - Orientation verticale.
    - **Texte/Nom** : Affiché en bas de la jauge.
    - **Niveau Actuel** : Animation fluide de la jauge qui monte et descend selon le bruit.
    - **Valeur Max** : Affichage du pic maximum atteint en haut de la jauge (réinitialisable).
- **Interactivité Passive** : 
    - Une jauge "en cours d'écoute" passe au premier plan.
    - Une jauge "désactivée" devient grise.

### 2. Espace Administration (Gestion)
- **Liste des Jauges** : Vue d'ensemble de toutes les instances créées.
- **Contrôles par Jauge** :
    - **Lancer l'écoute** : Active le microphone pour cette jauge spécifique et met à jour les données en temps réel.
    - **Réinitialiser** : Remet le pic maximum à zéro.
    - **Désactiver** : Rend la jauge inactive (grise sur l'écran public).
    - **Supprimer** : Retire la jauge de la liste.
- **Sélection du Micro** : (Optionnel mais recommandé) Permettre de choisir la source audio.

### 3. Architecture & Évolutivité
- L'application doit être conçue comme un **module** pouvant être intégré plus tard dans une "Master App" regroupant plusieurs outils (no-match, décibel-mètre, etc.).

## 🚀 Plan de Développement Suggéré
1. Initialisation du projet Tauri v2.
2. Mise en place du store Zustand pour la gestion des gauges.
3. Développement de la logique de capture audio (AudioContext API).
4. Création du composant Jauge animé.
5. Développement des vues Admin et Public avec synchronisation via LocalStorage.
