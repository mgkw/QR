#!/usr/bin/env python3
"""
Setup script for QR Scanner Python Flask Application
"""

from setuptools import setup, find_packages

setup(
    name="qr-scanner-flask",
    version="2.0.0",
    description="Advanced QR Code Scanner with Python Flask Backend",
    author="QR Scanner Team",
    python_requires=">=3.8",
    install_requires=[
        "Flask>=2.0.0",
        "Werkzeug>=2.0.0",
        "gunicorn>=20.1.0",
        "Pillow>=8.0.0",
    ],
    packages=find_packages(),
    include_package_data=True,
    zip_safe=False,
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Environment :: Web Environment",
        "Framework :: Flask",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Internet :: WWW/HTTP :: Dynamic Content",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
) 