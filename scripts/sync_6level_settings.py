import json

def main():
    with open('tab_visibility_6level.json', 'r', encoding='utf-8') as f:
        tab_vis = json.load(f)

    with open('edit_permissions_6level.json', 'r', encoding='utf-8') as f:
        edit_perm = json.load(f)

    # Update master_cbeo_data.json
    with open('master_cbeo_data.json', 'r', encoding='utf-8') as f:
        m = json.load(f)

    if 'portal_settings_bundle' in m:
        b = m['portal_settings_bundle']
        b['tab_visibility_6level'] = tab_vis
        b['tab_visibility_5level'] = tab_vis
        b['__TAB_VISIBILITY_6LEVEL__'] = tab_vis
        b['edit_permissions_6level'] = edit_perm
        b['edit_permissions_5level'] = edit_perm
        b['__EDIT_PERMISSIONS_6LEVEL__'] = edit_perm

    with open('master_cbeo_data.json', 'w', encoding='utf-8') as f:
        json.dump(m, f, ensure_ascii=False, indent=2)

    # Update master_cbeo_data.js
    with open('master_cbeo_data.js', 'w', encoding='utf-8') as f:
        f.write('const MASTER_CBEO_DATA = ' + json.dumps(m, ensure_ascii=False, indent=2) + ';\nif (typeof module !== "undefined") module.exports = MASTER_CBEO_DATA;\n')

    print('Successfully synced 6-level tab visibility & edit permissions to master_cbeo_data.json & .js!')

if __name__ == '__main__':
    main()
