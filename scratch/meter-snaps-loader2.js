/**
 * Client-side meter snap loading (usersnap API first, snaps.pitc.com.pk file fallback).
 */
(function () {
    var USERSNAP_API = 'https://usersnap.pitc.com.pk/api/SnapsForDuplicateBill/ToDuplicate';
    var DEFAULT_SNAPS_BASE = 'http://snaps.pitc.com.pk/';

    function getData(el, name, fallback) {
        var value = el.getAttribute('data-' + name);
        if (value === null || value === '') {
            return fallback || '';
        }
        return value;
    }

    function parseCount(value, fallback) {
        var count = parseInt(value, 10);
        return isNaN(count) ? fallback : count;
    }

    function buildSnapFilePrefix(grid) {
        var base = getData(grid, 'snaps-base', DEFAULT_SNAPS_BASE);
        if (base.charAt(base.length - 1) !== '/') {
            base += '/';
        }

        return base +
            getData(grid, 'company-code') + '000/' +
            getData(grid, 'circle') + '/' +
            getData(grid, 'division') + '/' +
            getData(grid, 'bill-ym') + '-' +
            getData(grid, 'batch') + '/' +
            getData(grid, 'bill-ym') +
            getData(grid, 'ref-no');
    }

    function createSnapCell(grid, src, index) {
        var cell = document.createElement('div');
        cell.className = 'meter-snap-cell';

        var img = document.createElement('img');
        img.src = src;
        img.alt = 'Meter snap ' + (index + 1);
        img.loading = 'lazy';

        cell.appendChild(img);
        grid.appendChild(cell);
        return cell;
    }

    function applyMeterSnapLayouts(grid) {
        var cells = grid.querySelectorAll('.meter-snap-cell:not(.meter-snap-cell--message)');
        var count = cells.length;

        grid.classList.remove(
            'meter-snaps-grid--layout-1',
            'meter-snaps-grid--layout-2',
            'meter-snaps-grid--layout-3',
            'meter-snaps-grid--layout-4'
        );

        if (count >= 1 && count <= 4) {
            grid.classList.add('meter-snaps-grid--layout-' + count);
        }
    }

    function showLoadingState(grid, meterCount) {
        grid.innerHTML = '';
        grid.classList.add('meter-snaps-grid--loading');

        for (var i = 0; i < meterCount; i++) {
            var skeleton = document.createElement('div');
            skeleton.className = 'meter-snap-cell meter-snap-cell--skeleton';
            skeleton.setAttribute('aria-hidden', 'true');
            grid.appendChild(skeleton);
        }

        applyMeterSnapLayouts(grid);

        var status = document.createElement('div');
        status.className = 'meter-snaps-loading-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.setAttribute('aria-label', 'Loading meter images');

        var spinner = document.createElement('span');
        spinner.className = 'meter-snaps-loading-spinner';
        spinner.setAttribute('aria-hidden', 'true');

        var label = document.createElement('span');
        label.className = 'meter-snaps-loading-label';
        label.textContent = 'Loading meter images…';

        status.appendChild(spinner);
        status.appendChild(label);
        grid.appendChild(status);
    }

    function finalizeGrid(grid) {
        grid.classList.remove('meter-snaps-grid--loading');
        applyMeterSnapLayouts(grid);

        if (typeof initMeterSnapZoom === 'function') {
            initMeterSnapZoom();
        }
    }

    function showAmiMessage(grid, message) {
        grid.innerHTML = '';

        var cell = document.createElement('div');
        cell.className = 'meter-snap-cell meter-snap-cell--message';

        var heading = document.createElement('h2');
        heading.className = 'meter-snap-ami-msg';
        heading.textContent = message;
        cell.appendChild(heading);

        grid.appendChild(cell);
        finalizeGrid(grid);
    }

    function showSnapError(grid, message) {
        grid.classList.remove('meter-snaps-grid--loading');
        grid.innerHTML = '';

        var card = grid.closest('.meter-snaps-card');
        if (!card) {
            return;
        }

        var errorEl = card.querySelector('.meter-snaps-error');
        if (errorEl) {
            errorEl.hidden = false;
            errorEl.textContent = message;
        }
    }

    function probeImage(url) {
        return new Promise(function (resolve) {
            var img = new Image();
            img.onload = function () { resolve(true); };
            img.onerror = function () { resolve(false); };
            img.src = url;
        });
    }

    function renderFromApi(grid, data, meterCount) {
        var useSnap5to8 = data.SNAP_5 && data.SNAP_5 !== 'null';
        var loaded = 0;

        grid.innerHTML = '';

        for (var i = 0; i < meterCount; i++) {
            var snapKey = useSnap5to8 ? 'SNAP_' + (i + 5) : 'SNAP_' + (i + 1);
            var base64Img = data[snapKey];

            if (base64Img && base64Img !== 'null') {
                createSnapCell(grid, 'data:image/png;base64,' + base64Img, i);
                loaded++;
            }
        }

        if (loaded > 0) {
            finalizeGrid(grid);
            return true;
        }

        return false;
    }

    function loadFromUsersnap(grid, meterCount) {
        var refNo = getData(grid, 'ref-no');
        var billMonth = getData(grid, 'bill-month');

        if (!refNo || !billMonth) {
            return Promise.resolve(false);
        }

        return fetch(USERSNAP_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                REF_NO: refNo,
                BILL_MONTH: billMonth
            })
        })
            .then(function (response) {
                if (!response.ok) {
                    return false;
                }
                return response.json();
            })
            .then(function (json) {
                if (!json || (String(json.STATUS) !== '1')) {
                    return false;
                }

                var data = json.DATA && json.DATA[0];
                if (!data) {
                    return false;
                }

                return renderFromApi(grid, data, meterCount);
            })
            .catch(function () {
                return false;
            });
    }

    function loadFromFileServer(grid, meterCount) {
        var prefix = buildSnapFilePrefix(grid);
        var tasks = [];

        showLoadingState(grid, meterCount);

        for (var i = 1; i <= meterCount; i++) {
            (function (index) {
                tasks.push(
                    probeImage(prefix + index + 'E.jpg').then(function (ok) {
                        return { ok: ok, index: index, url: prefix + index + 'E.jpg' };
                    })
                );
            })(i);
        }

        return Promise.all(tasks).then(function (results) {
            var loaded = 0;

            results.sort(function (a, b) {
                return a.index - b.index;
            });

            results.forEach(function (result) {
                if (result.ok) {
                    createSnapCell(grid, result.url, result.index - 1);
                    loaded++;
                }
            });

            if (loaded > 0) {
                finalizeGrid(grid);
                return true;
            }

            return false;
        });
    }

    function loadMeterSnaps(grid) {
        var amiMessage = getData(grid, 'ami-msg');
        if (amiMessage) {
            showAmiMessage(grid, amiMessage);
            return;
        }

        var meterCount = parseCount(getData(grid, 'meter-count'), 0);
        if (meterCount < 1) {
            grid.classList.remove('meter-snaps-grid--loading');
            return;
        }

        showLoadingState(grid, meterCount);

        loadFromUsersnap(grid, meterCount).then(function (usersnapOk) {
            if (usersnapOk) {
                return;
            }

            return loadFromFileServer(grid, meterCount).then(function (fileOk) {
                if (!fileOk) {
                    showSnapError(grid, 'Snap service temporarily unavailable.');
                }
            });
        });
    }

    function initMeterSnapsLoader() {
        document.querySelectorAll('[data-meter-snaps]').forEach(function (grid) {
            loadMeterSnaps(grid);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMeterSnapsLoader);
    } else {
        initMeterSnapsLoader();
    }

    window.initMeterSnapsLoader = initMeterSnapsLoader;
    window.applyMeterSnapLayouts = applyMeterSnapLayouts;
})();
