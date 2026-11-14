"""Simulador do IntriStock: corre as simulações que o backend põe na fila.

Lê as velas que o apps/downloader deixou no ClickHouse e grava os resultados.
Interpreta o grafo do editor de diagramas; nunca executa código do utilizador.
"""
