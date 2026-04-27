"""Vector-based similarity search index implementation."""

import math
from collections.abc import Callable
from typing import Any


class VectorIndex:
    """Vector similarity search index supporting cosine and Euclidean distance.

    Stores document vectors and supports similarity search using configurable
    distance metrics and optional embedding functions.
    """

    def __init__(
        self,
        distance_metric: str = "cosine",
        embedding_fn: Callable[[str], list[float]] | None = None,
    ) -> None:
        """Initialize vector index.

        Args:
            distance_metric: Distance metric to use ('cosine' or 'euclidean',
                default 'cosine').
            embedding_fn: Optional embedding function that converts strings to
                vectors.

        Raises:
            ValueError: If distance_metric is not 'cosine' or 'euclidean'.
        """
        self.vectors: list[list[float]] = []
        self.documents: list[dict[str, Any]] = []
        self._vector_dim: int | None = None
        if distance_metric not in ["cosine", "euclidean"]:
            raise ValueError("distance_metric must be 'cosine' or 'euclidean'")
        self._distance_metric = distance_metric
        self._embedding_fn = embedding_fn

    def add_document(self, document: dict[str, Any]) -> None:
        """Add a document with automatic embedding.

        Args:
            document: Dictionary containing document data with required
                'content' key.

        Raises:
            ValueError: If embedding function not provided.
            TypeError: If document is not a dict or content is not a string.
            ValueError: If document missing 'content' key.
        """
        if not self._embedding_fn:
            raise ValueError("Embedding function not provided during initialization.")
        if not isinstance(document, dict):
            raise TypeError("Document must be a dictionary.")
        if "content" not in document:
            raise ValueError("Document dictionary must contain a 'content' key.")

        content = document["content"]
        if not isinstance(content, str):
            raise TypeError("Document 'content' must be a string.")

        vector = self._embedding_fn(content)
        self.add_vector(vector=vector, document=document)

    def search(self, query: str | list[float], k: int = 1) -> list[tuple[dict[str, Any], float]]:
        """Search for top-k documents by vector similarity.

        Args:
            query: Query as string (will be embedded) or vector as list of floats.
            k: Number of results to return (default 1).

        Returns:
            list[tuple[dict[str, Any], float]]: List of (document, distance)
                tuples in ascending order of distance.

        Raises:
            ValueError: If embedding function missing for string query, if k is
                not positive, or if query vector dimension mismatch.
            TypeError: If query is neither string nor numeric list.
        """
        if not self.vectors:
            return []

        if isinstance(query, str):
            if not self._embedding_fn:
                raise ValueError("Embedding function not provided for string query.")
            query_vector = self._embedding_fn(query)
        elif isinstance(query, list) and all(isinstance(x, (int, float)) for x in query):
            query_vector = query
        else:
            raise TypeError("Query must be either a string or a list of numbers.")

        if self._vector_dim is None:
            return []

        if len(query_vector) != self._vector_dim:
            raise ValueError(
                f"Query vector dimension mismatch. Expected {self._vector_dim}, "
                f"got {len(query_vector)}"
            )

        if k <= 0:
            raise ValueError("k must be a positive integer.")

        if self._distance_metric == "cosine":
            dist_func = self._cosine_distance
        else:
            dist_func = self._euclidean_distance

        distances = []
        for i, stored_vector in enumerate(self.vectors):
            distance = dist_func(query_vector, stored_vector)
            distances.append((distance, self.documents[i]))

        distances.sort(key=lambda item: item[0])

        return [(doc, dist) for dist, doc in distances[:k]]

    def add_vector(self, vector: list[float], document: dict[str, Any]) -> None:
        """Add a pre-computed vector with its document.

        Args:
            vector: Vector as list of floats.
            document: Dictionary containing document data with required
                'content' key.

        Raises:
            TypeError: If vector is not numeric list or document is not dict.
            ValueError: If document missing 'content' key or dimension mismatch.
        """
        if not isinstance(vector, list) or not all(isinstance(x, (int, float)) for x in vector):
            raise TypeError("Vector must be a list of numbers.")
        if not isinstance(document, dict):
            raise TypeError("Document must be a dictionary.")
        if "content" not in document:
            raise ValueError("Document dictionary must contain a 'content' key.")

        if not self.vectors:
            self._vector_dim = len(vector)
        elif len(vector) != self._vector_dim:
            raise ValueError(
                f"Inconsistent vector dimension. Expected {self._vector_dim}, got {len(vector)}"
            )

        self.vectors.append(list(vector))
        self.documents.append(document)

    def _euclidean_distance(self, vec1: list[float], vec2: list[float]) -> float:
        """Compute Euclidean distance between two vectors.

        Args:
            vec1: First vector.
            vec2: Second vector.

        Returns:
            float: Euclidean distance.

        Raises:
            ValueError: If vectors have different dimensions.
        """
        if len(vec1) != len(vec2):
            raise ValueError("Vectors must have the same dimension")
        return math.sqrt(sum((p - q) ** 2 for p, q in zip(vec1, vec2)))

    def _dot_product(self, vec1: list[float], vec2: list[float]) -> float:
        """Compute dot product of two vectors.

        Args:
            vec1: First vector.
            vec2: Second vector.

        Returns:
            float: Dot product.

        Raises:
            ValueError: If vectors have different dimensions.
        """
        if len(vec1) != len(vec2):
            raise ValueError("Vectors must have the same dimension")
        return sum(p * q for p, q in zip(vec1, vec2))

    def _magnitude(self, vec: list[float]) -> float:
        """Compute magnitude (L2 norm) of a vector.

        Args:
            vec: Vector.

        Returns:
            float: Magnitude of the vector.
        """
        return math.sqrt(sum(x * x for x in vec))

    def _cosine_distance(self, vec1: list[float], vec2: list[float]) -> float:
        """Compute cosine distance (1 - cosine similarity) between vectors.

        Args:
            vec1: First vector.
            vec2: Second vector.

        Returns:
            float: Cosine distance in range [0, 2].

        Raises:
            ValueError: If vectors have different dimensions.
        """
        if len(vec1) != len(vec2):
            raise ValueError("Vectors must have the same dimension")

        mag1 = self._magnitude(vec1)
        mag2 = self._magnitude(vec2)

        if mag1 == 0 and mag2 == 0:
            return 0.0
        elif mag1 == 0 or mag2 == 0:
            return 1.0

        dot_prod = self._dot_product(vec1, vec2)
        cosine_similarity = dot_prod / (mag1 * mag2)
        cosine_similarity = max(-1.0, min(1.0, cosine_similarity))

        return 1.0 - cosine_similarity

    def __len__(self) -> int:
        """Return number of vectors in the index."""
        return len(self.vectors)

    def __repr__(self) -> str:
        """Return string representation of the index."""
        has_embed_fn = "Yes" if self._embedding_fn else "No"
        return (
            f"VectorIndex(count={len(self)}, dim={self._vector_dim}, "
            f"metric='{self._distance_metric}', has_embedding_fn='{has_embed_fn}')"
        )
