"""Unambiguous JSON for small, user-specified pixel selections."""

import json


def load_selection(raw):
    def unique_pairs(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate selection key")
            result[key] = value
        return result

    def invalid_constant(_):
        raise ValueError("Non-finite selection value")

    return json.loads(raw, object_pairs_hook=unique_pairs, parse_constant=invalid_constant)
