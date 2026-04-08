"""BM25 full-text search index implementation."""

import math
import re
from collections import Counter
from collections.abc import Callable
from typing import Any


class BM25Index:
    """BM25 (Best Matching 25) full-text search index.

    Implements the BM25 ranking algorithm for relevance-based document retrieval.
    Supports custom tokenization and configurable parameters (k1, b).
    """

    def __init__(
        self,
        k1: float = 1.5,
        b: float = 0.75,
        tokenizer: Callable[[str], list[str]] | None = None,
    ) -> None:
        """Initialize BM25 index.

        Args:
            k1: Parameter controlling term frequency saturation point (default 1.5).
            b: Parameter controlling impact of document length (default 0.75).
            tokenizer: Optional custom tokenization function. Defaults to lowercase
                splitting on non-word characters.
        """
        self.documents: list[dict[str, Any]] = []
        self._corpus_tokens: list[list[str]] = []
        self._doc_len: list[int] = []
        self._doc_freqs: dict[str, int] = {}
        self._avg_doc_len: float = 0.0
        self._idf: dict[str, float] = {}
        self._index_built: bool = False

        self.k1 = k1
        self.b = b
        self._tokenizer = tokenizer if tokenizer else self._default_tokenizer

    def _default_tokenizer(self, text: str) -> list[str]:
        """Tokenize text by splitting on non-word characters.

        Args:
            text: Text to tokenize.

        Returns:
            list[str]: List of lowercase tokens.
        """
        text = text.lower()
        tokens = re.split(r"\W+", text)
        return [token for token in tokens if token]

    def _update_stats_add(self, doc_tokens: list[str]) -> None:
        """Update document statistics after adding new document.

        Args:
            doc_tokens: Tokenized document content.
        """
        self._doc_len.append(len(doc_tokens))

        seen_in_doc = set()
        for token in doc_tokens:
            if token not in seen_in_doc:
                self._doc_freqs[token] = self._doc_freqs.get(token, 0) + 1
                seen_in_doc.add(token)

        self._index_built = False

    def _calculate_idf(self) -> None:
        """Calculate inverse document frequency for all terms.

        Uses standard BM25 IDF formula: log(((N - df + 0.5) / (df + 0.5)) + 1).
        """
        num_docs = len(self.documents)
        self._idf = {}
        for term, freq in self._doc_freqs.items():
            idf_score = math.log(((num_docs - freq + 0.5) / (freq + 0.5)) + 1)
            self._idf[term] = idf_score

    def _build_index(self) -> None:
        """Build the index by calculating IDF scores and average document length."""
        if not self.documents:
            self._avg_doc_len = 0.0
            self._idf = {}
            self._index_built = True
            return

        self._avg_doc_len = sum(self._doc_len) / len(self.documents)
        self._calculate_idf()
        self._index_built = True

    def add_document(self, document: dict[str, Any]) -> None:
        """Add a document to the index.

        Args:
            document: Dictionary containing document data with required 'content' key.

        Raises:
            TypeError: If document is not a dict or content is not a string.
            ValueError: If document missing 'content' key.
        """
        if not isinstance(document, dict):
            raise TypeError("Document must be a dictionary.")
        if "content" not in document:
            raise ValueError("Document dictionary must contain a 'content' key.")

        content = document.get("content", "")
        if not isinstance(content, str):
            raise TypeError("Document 'content' must be a string.")

        doc_tokens = self._tokenizer(content)

        self.documents.append(document)
        self._corpus_tokens.append(doc_tokens)
        self._update_stats_add(doc_tokens)

    def _compute_bm25_score(self, query_tokens: list[str], doc_index: int) -> float:
        """Compute BM25 score for a query against a document.

        Args:
            query_tokens: List of query tokens.
            doc_index: Index of document in the corpus.

        Returns:
            float: BM25 relevance score.
        """
        score = 0.0
        doc_term_counts = Counter(self._corpus_tokens[doc_index])
        doc_length = self._doc_len[doc_index]

        for token in query_tokens:
            if token not in self._idf:
                continue

            idf = self._idf[token]
            term_freq = doc_term_counts.get(token, 0)

            numerator = idf * term_freq * (self.k1 + 1)
            denominator = term_freq + self.k1 * (
                1 - self.b + self.b * (doc_length / self._avg_doc_len)
            )
            score += numerator / (denominator + 1e-9)

        return score

    def search(
        self,
        query_text: str,
        k: int = 1,
        score_normalization_factor: float = 0.1,
    ) -> list[tuple[dict[str, Any], float]]:
        """Search for top-k documents matching the query.

        Args:
            query_text: Query string.
            k: Number of results to return (default 1).
            score_normalization_factor: Factor for normalizing raw scores
                (default 0.1).

        Returns:
            list[tuple[dict[str, Any], float]]: List of (document, score) tuples
                in ascending order of normalized score.

        Raises:
            TypeError: If query_text is not a string.
            ValueError: If k is not positive.
        """
        if not self.documents:
            return []

        if not isinstance(query_text, str):
            raise TypeError("Query text must be a string.")

        if k <= 0:
            raise ValueError("k must be a positive integer.")

        if not self._index_built:
            self._build_index()

        if self._avg_doc_len == 0:
            return []

        query_tokens = self._tokenizer(query_text)
        if not query_tokens:
            return []

        raw_scores = []
        for i in range(len(self.documents)):
            raw_score = self._compute_bm25_score(query_tokens, i)
            if raw_score > 1e-9:
                raw_scores.append((raw_score, self.documents[i]))

        raw_scores.sort(key=lambda item: item[0], reverse=True)

        normalized_results = []
        for raw_score, doc in raw_scores[:k]:
            normalized_score = math.exp(-score_normalization_factor * raw_score)
            normalized_results.append((doc, normalized_score))

        normalized_results.sort(key=lambda item: item[1])

        return normalized_results

    def __len__(self) -> int:
        """Return number of documents in the index."""
        return len(self.documents)

    def __repr__(self) -> str:
        """Return string representation of the index."""
        return (
            f"BM25Index(count={len(self)}, k1={self.k1}, b={self.b}, "
            f"index_built={self._index_built})"
        )
